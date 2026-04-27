import type {
  BrowserDependencyRecord,
  BrowserPackageRecord,
  BrowserPackageSourceType,
} from '@root/lib/browser/packages';

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
  sourceType: Extract<BrowserPackageSourceType, 'bun' | 'node-modules'>;
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
  indexDirectoryPackages(event.data).catch((error: unknown) => {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  });
};

async function indexDirectoryPackages({
  handle,
  sourceType,
  full,
  lastIndexedAt,
}: WorkerRequest): Promise<void> {
  let scanned = 0;
  let indexed = 0;
  let skipped = 0;
  let errors = 0;
  let unchanged = 0;
  let batch: BrowserPackageRecord[] = [];

  for await (const packageDir of findPackageDirectories(handle, sourceType)) {
    scanned++;
    try {
      const manifestHandle = await packageDir.getFileHandle('package.json');
      const manifestFile = await manifestHandle.getFile();
      if (!full && lastIndexedAt > 0 && manifestFile.lastModified <= lastIndexedAt) {
        unchanged++;
        continue;
      }

      const record = await processPackageDirectory({
        dir: packageDir,
        manifestFile,
        sourceRoot: handle,
        sourceType,
      });
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

  if (batch.length > 0) {
    post({ type: 'batch', packages: batch });
  }
  post({ type: 'done', scanned, indexed, skipped, errors, unchanged });
}

async function processPackageDirectory({
  dir,
  manifestFile,
  sourceRoot,
  sourceType,
}: {
  dir: FileSystemDirectoryHandle;
  manifestFile: File;
  sourceRoot: FileSystemDirectoryHandle;
  sourceType: Extract<BrowserPackageSourceType, 'bun' | 'node-modules'>;
}): Promise<BrowserPackageRecord | null> {
  const pkgJson = JSON.parse(await manifestFile.text()) as PackageJson;
  if (!pkgJson.name || !pkgJson.version) return null;

  const readme = await readReadme(dir);
  const fileStats = await countFiles(dir);
  const dependencies = collectDependencies(pkgJson);
  const keywords = pkgJson.keywords ?? [];
  const description = pkgJson.description ?? null;
  const now = Date.now();

  return {
    key: `${pkgJson.name}@${pkgJson.version}`,
    name: pkgJson.name,
    version: pkgJson.version,
    description,
    keywords,
    readme,
    license: normalizeLicense(pkgJson.license),
    repository: normalizeRepository(pkgJson.repository),
    homepage: pkgJson.homepage ?? null,
    author: normalizeAuthor(pkgJson.author),
    hasBuild: false,
    fileCount: fileStats.fileCount,
    totalSize: fileStats.totalSize,
    dependencyCount: dependencies.length,
    dependencies,
    sources: [{ type: sourceType, label: sourceRoot.name, indexedAt: now }],
    indexedAt: now,
    sourceMtime: manifestFile.lastModified,
    searchText:
      `${pkgJson.name} ${description ?? ''} ${keywords.join(' ')} ${readme?.slice(0, 4000) ?? ''}`.toLowerCase(),
  };
}

async function* findPackageDirectories(
  root: FileSystemDirectoryHandle,
  sourceType: Extract<BrowserPackageSourceType, 'bun' | 'node-modules'>,
): AsyncIterable<FileSystemDirectoryHandle> {
  if (sourceType === 'node-modules') {
    yield* findNodeModulesPackages(root);
    return;
  }

  for await (const [, child] of entries(root)) {
    if (child.kind !== 'directory') continue;
    if (await hasPackageJson(child)) {
      yield child;
    }
  }
}

async function* findNodeModulesPackages(
  root: FileSystemDirectoryHandle,
): AsyncIterable<FileSystemDirectoryHandle> {
  for await (const [name, child] of entries(root)) {
    if (child.kind !== 'directory') continue;
    if (name.startsWith('.')) continue;

    if (name.startsWith('@')) {
      for await (const [, scopedChild] of entries(child)) {
        if (scopedChild.kind === 'directory' && (await hasPackageJson(scopedChild))) {
          yield scopedChild;
        }
      }
      continue;
    }

    if (await hasPackageJson(child)) {
      yield child;
    }
  }
}

async function hasPackageJson(dir: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    await dir.getFileHandle('package.json');
    return true;
  } catch {
    return false;
  }
}

async function readReadme(dir: FileSystemDirectoryHandle): Promise<string | null> {
  for await (const [name, child] of entries(dir)) {
    if (child.kind !== 'file' || !/^readme(\.[a-z]+)?$/i.test(name)) continue;
    const text = await (await child.getFile()).text();
    return text.length > 50_000 ? `${text.slice(0, 50_000)}\n\n[truncated]` : text;
  }
  return null;
}

async function countFiles(dir: FileSystemDirectoryHandle): Promise<{
  fileCount: number;
  totalSize: number;
}> {
  let fileCount = 0;
  let totalSize = 0;

  async function walk(current: FileSystemDirectoryHandle, depth: number): Promise<void> {
    if (depth > 8) return;
    for await (const [name, child] of entries(current)) {
      if (name === 'node_modules' || name === '.git') continue;
      if (child.kind === 'directory') {
        await walk(child, depth + 1);
      } else {
        const file = await child.getFile();
        fileCount++;
        totalSize += file.size;
      }
    }
  }

  await walk(dir, 0);
  return { fileCount, totalSize };
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

function collectDependencies(pkgJson: PackageJson): BrowserDependencyRecord[] {
  const fields: Array<[keyof PackageJson, BrowserDependencyRecord['dep_type']]> = [
    ['dependencies', 'runtime'],
    ['devDependencies', 'dev'],
    ['peerDependencies', 'peer'],
    ['optionalDependencies', 'optional'],
  ];
  const deps: BrowserDependencyRecord[] = [];

  for (const [field, type] of fields) {
    const entries = pkgJson[field] as Record<string, string> | undefined;
    if (!entries) continue;
    for (const [depName, depVersion] of Object.entries(entries)) {
      deps.push({ dep_name: depName, dep_version: depVersion, dep_type: type });
    }
  }

  return deps;
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
