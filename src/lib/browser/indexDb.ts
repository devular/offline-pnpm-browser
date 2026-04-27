import type {
  BrowserDependentsResponse,
  BrowserIndexStats,
  BrowserPackageDetail,
  BrowserPackageRecord,
  BrowserPackageSourceType,
  BrowserSearchResponse,
  BrowserSearchResultItem,
} from './packages';
import { getBrowserCategoriesForPackage } from './categories';

const DB_NAME = 'offline-pnpm-browser';
const DB_VERSION = 1;
const PACKAGE_STORE = 'packages';
const META_STORE = 'metadata';

type MaybeStoreHandle = FileSystemDirectoryHandle | null;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PACKAGE_STORE)) {
        const packages = db.createObjectStore(PACKAGE_STORE, { keyPath: 'key' });
        packages.createIndex('name', 'name', { unique: false });
        packages.createIndex('sourceMtime', 'sourceMtime', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getMeta<T>(key: string): Promise<T | null> {
  const db = await openDb();
  const tx = db.transaction(META_STORE, 'readonly');
  const value = await requestResult<T | undefined>(tx.objectStore(META_STORE).get(key));
  await txDone(tx);
  return value ?? null;
}

async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(META_STORE, 'readwrite');
  tx.objectStore(META_STORE).put(value, key);
  await txDone(tx);
}

export async function savePnpmStoreHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await setMeta('pnpmStoreHandle', handle);
  await setMeta('storeName', handle.name);
}

export function loadPnpmStoreHandle(): Promise<MaybeStoreHandle> {
  return getMeta<FileSystemDirectoryHandle>('pnpmStoreHandle');
}

export async function hasReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  const permission = await handle.queryPermission({ mode: 'read' });
  if (permission === 'granted') return true;
  return (await handle.requestPermission({ mode: 'read' })) === 'granted';
}

export async function clearBrowserIndex(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([PACKAGE_STORE, META_STORE], 'readwrite');
  tx.objectStore(PACKAGE_STORE).clear();
  tx.objectStore(META_STORE).delete('lastIndexedAt');
  await txDone(tx);
}

export async function putPackageBatch(packages: BrowserPackageRecord[]): Promise<void> {
  if (packages.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(PACKAGE_STORE, 'readwrite');
  const store = tx.objectStore(PACKAGE_STORE);
  for (const incoming of packages) {
    const existing = await requestResult<BrowserPackageRecord | undefined>(store.get(incoming.key));
    store.put(existing ? mergePackageRecord(existing, incoming) : incoming);
  }
  await txDone(tx);
}

export async function finishBrowserIndex(storeName: string, indexedAt: number): Promise<void> {
  await setMeta('storeName', storeName);
  await setMeta('lastIndexedAt', indexedAt);
}

export async function getBrowserIndexStats(): Promise<BrowserIndexStats> {
  const db = await openDb();
  const tx = db.transaction([PACKAGE_STORE, META_STORE], 'readonly');
  const packages = await requestResult<BrowserPackageRecord[]>(
    tx.objectStore(PACKAGE_STORE).getAll(),
  );
  const meta = tx.objectStore(META_STORE);
  const [lastIndexedAt, storeName] = await Promise.all([
    requestResult<number | undefined>(meta.get('lastIndexedAt')),
    requestResult<string | undefined>(meta.get('storeName')),
  ]);
  await txDone(tx);

  const names = new Set<string>();
  const sourceCounts = new Map<BrowserPackageSourceType, number>();
  let totalSize = 0;
  let totalDependencies = 0;
  for (const pkg of packages) {
    names.add(pkg.name);
    totalSize += pkg.totalSize;
    totalDependencies += pkg.dependencyCount ?? 0;
    for (const source of pkg.sources ?? []) {
      sourceCounts.set(source.type, (sourceCounts.get(source.type) ?? 0) + 1);
    }
  }

  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;

  return {
    totalPackages: packages.length,
    uniquePackages: names.size,
    totalDependencies,
    totalSize,
    sourceBreakdown: Array.from(sourceCounts, ([type, versions]) => ({ type, versions })).sort(
      (a, b) => b.versions - a.versions || a.type.localeCompare(b.type),
    ),
    lastIndexedAt: lastIndexedAt ?? null,
    storeName: storeName ?? null,
    persisted,
  };
}

export async function searchBrowserPackages(
  query: string,
  limit = 50,
): Promise<BrowserSearchResponse> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return { query, count: 0, results: [] };

  const db = await openDb();
  const tx = db.transaction(PACKAGE_STORE, 'readonly');
  const packages = await requestResult<BrowserPackageRecord[]>(
    tx.objectStore(PACKAGE_STORE).getAll(),
  );
  await txDone(tx);

  const terms = normalized.split(/\s+/).filter(Boolean);
  const scored = packages
    .map((pkg) => ({ pkg, score: scorePackage(pkg, normalized, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || compareSemver(a.pkg.version, b.pkg.version));

  const collapsed = collapseVersions(scored.map((item) => item.pkg));
  return {
    query,
    count: collapsed.length,
    results: collapsed.slice(0, Math.min(limit, 200)),
  };
}

export async function getBrowserPackageDetail(
  name: string,
  version?: string,
): Promise<BrowserPackageDetail | null> {
  const db = await openDb();
  const tx = db.transaction(PACKAGE_STORE, 'readonly');
  const index = tx.objectStore(PACKAGE_STORE).index('name');
  const packages = await requestResult<BrowserPackageRecord[]>(index.getAll(name));
  await txDone(tx);
  if (packages.length === 0) return null;

  packages.sort((a, b) => compareSemver(a.version, b.version));
  const selected = version ? packages.find((pkg) => pkg.version === version) : packages[0];
  if (!selected) return null;

  return {
    ...selected,
    versions: packages.map((pkg, i) => ({ id: i, version: pkg.version })),
    categories: getBrowserCategoriesForPackage(selected.name),
    dependenciesByType: {
      runtime: (selected.dependencies ?? []).filter((dep) => dep.dep_type === 'runtime'),
      dev: (selected.dependencies ?? []).filter((dep) => dep.dep_type === 'dev'),
      peer: (selected.dependencies ?? []).filter((dep) => dep.dep_type === 'peer'),
      optional: (selected.dependencies ?? []).filter((dep) => dep.dep_type === 'optional'),
    },
  };
}

export async function getBrowserDependents(name: string): Promise<BrowserDependentsResponse> {
  const db = await openDb();
  const tx = db.transaction(PACKAGE_STORE, 'readonly');
  const packages = await requestResult<BrowserPackageRecord[]>(
    tx.objectStore(PACKAGE_STORE).getAll(),
  );
  await txDone(tx);

  const dependents = packages
    .flatMap((pkg) =>
      (pkg.dependencies ?? [])
        .filter((dep) => dep.dep_name === name)
        .map((dep) => ({
          name: pkg.name,
          version: pkg.version,
          dep_version: dep.dep_version,
          dep_type: dep.dep_type,
        })),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return { package: name, count: dependents.length, dependents };
}

function scorePackage(pkg: BrowserPackageRecord, query: string, terms: string[]): number {
  const name = pkg.name.toLowerCase();
  if (name === query) return 1_000;
  if (name.startsWith(query)) return 800;
  if (name.includes(query)) return 650;
  if (terms.every((term) => pkg.searchText.includes(term))) return 300;
  if (terms.some((term) => pkg.searchText.includes(term))) return 100;
  return 0;
}

function collapseVersions(packages: BrowserPackageRecord[]): BrowserSearchResultItem[] {
  const map = new Map<string, BrowserSearchResultItem>();
  for (const pkg of packages) {
    const existing = map.get(pkg.name);
    if (existing) {
      if (!existing.versions.includes(pkg.version)) {
        existing.versions.push(pkg.version);
        existing.versions.sort(compareSemver);
        existing.latestVersion = existing.versions[0];
      }
      continue;
    }
    map.set(pkg.name, {
      name: pkg.name,
      latestVersion: pkg.version,
      versions: [pkg.version],
      description: pkg.description,
      keywords: pkg.keywords,
      license: pkg.license,
    });
  }
  return Array.from(map.values());
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function mergePackageRecord(
  existing: BrowserPackageRecord,
  incoming: BrowserPackageRecord,
): BrowserPackageRecord {
  const sourceMap = new Map(
    [...(existing.sources ?? []), ...(incoming.sources ?? [])].map((source) => [
      `${source.type}:${source.label}`,
      source,
    ]),
  );

  return {
    ...existing,
    ...incoming,
    readme: incoming.readme ?? existing.readme,
    description: incoming.description ?? existing.description,
    keywords: incoming.keywords.length > 0 ? incoming.keywords : existing.keywords,
    dependencies:
      incoming.dependencies.length > 0 ? incoming.dependencies : (existing.dependencies ?? []),
    dependencyCount: incoming.dependencyCount || existing.dependencyCount || 0,
    totalSize: Math.max(incoming.totalSize, existing.totalSize),
    sources: Array.from(sourceMap.values()).sort((a, b) => a.type.localeCompare(b.type)),
  };
}
