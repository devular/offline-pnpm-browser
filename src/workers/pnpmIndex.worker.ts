import type { BrowserPackageRecord } from '@root/lib/browser/packages';

interface IndexFile {
  name: string;
  version: string;
  requiresBuild?: boolean;
  files: Record<
    string,
    {
      checkedAt: number;
      integrity: string;
      mode: number;
      size: number;
    }
  >;
}

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  keywords?: string[];
  license?: string | { type?: string };
  repository?: string | { type?: string; url?: string };
  homepage?: string;
  author?: string | { name?: string; email?: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

type WorkerRequest = {
  type: 'start';
  handle: FileSystemDirectoryHandle;
  full: boolean;
  lastIndexedAt: number;
};

type WorkerResponse =
  | { type: 'batch'; packages: BrowserPackageRecord[] }
  | {
      type: 'progress';
      scanned: number;
      indexed: number;
      skipped: number;
      errors: number;
      unchanged: number;
    }
  | {
      type: 'done';
      scanned: number;
      indexed: number;
      skipped: number;
      errors: number;
      unchanged: number;
    }
  | { type: 'error'; message: string };

const ctx = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== 'start') return;
  indexStore(event.data).catch((error: unknown) => {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  });
};

async function indexStore({ handle, full, lastIndexedAt }: WorkerRequest): Promise<void> {
  const indexDir = await handle.getDirectoryHandle('index');

  let scanned = 0;
  let indexed = 0;
  let skipped = 0;
  let errors = 0;
  let unchanged = 0;
  let batch: BrowserPackageRecord[] = [];

  for await (const [, hashDir] of entries(indexDir)) {
    if (hashDir.kind !== 'directory') continue;

    for await (const [fileName, fileHandle] of entries(hashDir)) {
      if (fileHandle.kind !== 'file' || !fileName.endsWith('.json')) continue;
      scanned++;

      try {
        const file = await fileHandle.getFile();
        if (!full && lastIndexedAt > 0 && file.lastModified <= lastIndexedAt) {
          unchanged++;
          continue;
        }

        const index = JSON.parse(await file.text()) as IndexFile;
        const record = await processPackage(index, handle, file.lastModified);
        if (!record) {
          skipped++;
          continue;
        }

        batch.push(record);
        indexed++;
        if (batch.length >= 100) {
          post({ type: 'batch', packages: batch });
          batch = [];
        }
      } catch {
        errors++;
      }

      if (scanned % 250 === 0) {
        post({ type: 'progress', scanned, indexed, skipped, errors, unchanged });
      }
    }
  }

  if (batch.length > 0) {
    post({ type: 'batch', packages: batch });
  }
  post({ type: 'done', scanned, indexed, skipped, errors, unchanged });
}

async function processPackage(
  index: IndexFile,
  storeHandle: FileSystemDirectoryHandle,
  sourceMtime: number,
): Promise<BrowserPackageRecord | null> {
  if (!index.name || !index.version || !index.files) return null;

  const pkgJsonIntegrity = index.files['package.json']?.integrity;
  let pkgJson: PackageJson = { name: index.name, version: index.version };

  if (pkgJsonIntegrity) {
    const content = await readStoreFile(storeHandle, pkgJsonIntegrity);
    if (content) {
      try {
        pkgJson = JSON.parse(content) as PackageJson;
      } catch {
        pkgJson = { name: index.name, version: index.version };
      }
    }
  }

  let readme: string | null = null;
  const readmeKey = Object.keys(index.files).find((key) => /^readme/i.test(key));
  if (readmeKey) {
    readme = await readStoreFile(storeHandle, index.files[readmeKey].integrity);
    if (readme && readme.length > 50_000) {
      readme = `${readme.slice(0, 50_000)}\n\n[truncated]`;
    }
  }

  const keywords = pkgJson.keywords ?? [];
  const description = pkgJson.description ?? null;
  const fileCount = Object.keys(index.files).length;
  const totalSize = Object.values(index.files).reduce((sum, file) => sum + (file.size || 0), 0);
  const dependencyCount = countDependencies(pkgJson);
  const name = index.name;
  const version = index.version;

  return {
    key: `${name}@${version}`,
    name,
    version,
    description,
    keywords,
    readme,
    license: normalizeLicense(pkgJson.license),
    repository: normalizeRepository(pkgJson.repository),
    homepage: pkgJson.homepage ?? null,
    author: normalizeAuthor(pkgJson.author),
    hasBuild: Boolean(index.requiresBuild),
    fileCount,
    totalSize,
    dependencyCount,
    indexedAt: Date.now(),
    sourceMtime,
    searchText:
      `${name} ${description ?? ''} ${keywords.join(' ')} ${readme?.slice(0, 4000) ?? ''}`.toLowerCase(),
  };
}

async function readStoreFile(
  storeHandle: FileSystemDirectoryHandle,
  integrity: string,
): Promise<string | null> {
  const parts = integrityToParts(integrity);
  if (!parts) return null;

  try {
    const filesDir = await storeHandle.getDirectoryHandle('files');
    const hashDir = await filesDir.getDirectoryHandle(parts.dir);
    const fileHandle = await hashDir.getFileHandle(parts.file);
    return await (await fileHandle.getFile()).text();
  } catch {
    return null;
  }
}

function integrityToParts(integrity: string): { dir: string; file: string } | null {
  const match = integrity.match(/^sha512-(.+)$/);
  if (!match) return null;

  const bytes = Uint8Array.from(atob(match[1]), (char) => char.charCodeAt(0));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { dir: hex.slice(0, 2), file: hex.slice(2) };
}

function normalizeRepository(repo: PackageJson['repository']): string | null {
  if (!repo) return null;
  if (typeof repo === 'string') return repo;
  return repo.url ?? null;
}

function normalizeLicense(license: PackageJson['license']): string | null {
  if (!license) return null;
  if (typeof license === 'string') return license;
  return license.type ?? null;
}

function normalizeAuthor(author: PackageJson['author']): string | null {
  if (!author) return null;
  if (typeof author === 'string') return author;
  return author.name ?? null;
}

function countDependencies(pkgJson: PackageJson): number {
  return (
    Object.keys(pkgJson.dependencies ?? {}).length +
    Object.keys(pkgJson.devDependencies ?? {}).length +
    Object.keys(pkgJson.peerDependencies ?? {}).length +
    Object.keys(pkgJson.optionalDependencies ?? {}).length
  );
}

function entries(
  dir: FileSystemDirectoryHandle,
): AsyncIterable<[string, FileSystemDirectoryHandle | FileSystemFileHandle]> {
  return (
    dir as unknown as {
      entries(): AsyncIterable<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;
    }
  ).entries();
}

function post(message: WorkerResponse): void {
  ctx.postMessage(message);
}
