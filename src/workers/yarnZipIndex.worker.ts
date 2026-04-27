import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import type { BrowserDependencyRecord, BrowserPackageRecord } from '@root/lib/browser/packages';

type ZipFileEntry = {
  directory?: boolean;
  filename: string;
  uncompressedSize?: number;
  getData(writer: TextWriter): Promise<string>;
};

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
  indexYarnCache(event.data).catch((error: unknown) => {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  });
};

async function indexYarnCache({ handle, full, lastIndexedAt }: WorkerRequest): Promise<void> {
  let scanned = 0;
  let indexed = 0;
  let skipped = 0;
  let errors = 0;
  let unchanged = 0;
  let batch: BrowserPackageRecord[] = [];

  for await (const [fileName, child] of entries(handle)) {
    if (child.kind !== 'file' || !fileName.endsWith('.zip')) continue;
    scanned++;

    try {
      const file = await child.getFile();
      if (!full && lastIndexedAt > 0 && file.lastModified <= lastIndexedAt) {
        unchanged++;
        continue;
      }

      const record = await processYarnArchive(file, handle.name);
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

    if (scanned % 100 === 0) {
      post({ type: 'progress', scanned, indexed, skipped, errors, unchanged });
    }
  }

  if (batch.length > 0) {
    post({ type: 'batch', packages: batch });
  }
  post({ type: 'done', scanned, indexed, skipped, errors, unchanged });
}

async function processYarnArchive(
  file: File,
  sourceLabel: string,
): Promise<BrowserPackageRecord | null> {
  const reader = new ZipReader(new BlobReader(file));
  try {
    const entries = (await reader.getEntries()) as unknown[];
    const manifestEntry = entries
      .filter((entry): entry is ZipFileEntry => isZipFileEntry(entry))
      .filter((entry) => entry.filename.endsWith('/package.json'))
      .sort((a, b) => a.filename.length - b.filename.length)[0];

    if (!manifestEntry) return null;

    const pkgJson = JSON.parse(await manifestEntry.getData(new TextWriter())) as PackageJson;
    if (!pkgJson.name || !pkgJson.version) return null;

    const readmeEntry = entries
      .filter((entry): entry is ZipFileEntry => isZipFileEntry(entry))
      .filter((entry) => /\/readme(\.[a-z]+)?$/i.test(entry.filename))
      .sort((a, b) => a.filename.length - b.filename.length)[0];
    const rawReadme = readmeEntry ? await readmeEntry.getData(new TextWriter()) : null;
    const readme =
      rawReadme && rawReadme.length > 50_000
        ? `${rawReadme.slice(0, 50_000)}\n\n[truncated]`
        : rawReadme;

    const dependencies = collectDependencies(pkgJson);
    const keywords = pkgJson.keywords ?? [];
    const description = pkgJson.description ?? null;
    const fileEntries = entries.filter((entry): entry is ZipFileEntry => isZipFileEntry(entry));
    const totalSize = fileEntries.reduce((sum, entry) => sum + (entry.uncompressedSize ?? 0), 0);
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
      fileCount: fileEntries.length,
      totalSize,
      dependencyCount: dependencies.length,
      dependencies,
      sources: [{ type: 'yarn', label: sourceLabel, indexedAt: now }],
      indexedAt: now,
      sourceMtime: file.lastModified,
      searchText:
        `${pkgJson.name} ${description ?? ''} ${keywords.join(' ')} ${readme?.slice(0, 4000) ?? ''}`.toLowerCase(),
    };
  } finally {
    await reader.close();
  }
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

function isZipFileEntry(entry: unknown): entry is ZipFileEntry {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'filename' in entry &&
    'getData' in entry &&
    !('directory' in entry && entry.directory)
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
