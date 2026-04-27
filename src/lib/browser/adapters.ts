import type { BrowserPackageRecord, BrowserPackageSourceType } from './packages';

export interface PackageSourceAdapter {
  id: BrowserPackageSourceType;
  label: string;
  description: string;
  status: 'ready' | 'planned';
  folderHint: string;
  detect(handle: FileSystemDirectoryHandle): boolean | Promise<boolean>;
}

export interface PackageIndexCallbacks {
  onBatch(packages: BrowserPackageRecord[]): Promise<void>;
  onProgress(progress: {
    scanned: number;
    indexed: number;
    skipped: number;
    errors: number;
    unchanged: number;
  }): void;
}

export const packageSourceAdapters: PackageSourceAdapter[] = [
  {
    id: 'pnpm',
    label: 'pnpm store',
    description: 'Content-addressable pnpm v10 store with index and files directories.',
    status: 'ready',
    folderHint: 'Choose the folder returned by pnpm store path.',
    detect: async (handle) => {
      try {
        await handle.getDirectoryHandle('index');
        await handle.getDirectoryHandle('files');
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    id: 'bun',
    label: 'Bun cache',
    description: 'Bun global package cache, usually ~/.bun/install/cache.',
    status: 'planned',
    folderHint: 'Choose the folder configured by BUN_INSTALL_CACHE_DIR or Bun defaults.',
    detect: () => false,
  },
  {
    id: 'yarn',
    label: 'Yarn cache',
    description: 'Yarn Berry zip cache, usually .yarn/cache or the configured cacheFolder.',
    status: 'planned',
    folderHint: 'Choose a folder containing Yarn package zip archives.',
    detect: () => false,
  },
  {
    id: 'node-modules',
    label: 'node_modules',
    description: 'Fallback source for npm-style installs without reading npm cache internals.',
    status: 'planned',
    folderHint: 'Choose a node_modules folder.',
    detect: () => false,
  },
];
