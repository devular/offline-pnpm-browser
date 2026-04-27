export interface BrowserPackageRecord {
  key: string;
  name: string;
  version: string;
  description: string | null;
  keywords: string[];
  readme: string | null;
  license: string | null;
  repository: string | null;
  homepage: string | null;
  author: string | null;
  hasBuild: boolean;
  fileCount: number;
  totalSize: number;
  dependencyCount: number;
  dependencies: BrowserDependencyRecord[];
  sources: BrowserPackageSource[];
  indexedAt: number;
  sourceMtime: number;
  searchText: string;
}

export type BrowserPackageSourceType = 'pnpm' | 'bun' | 'yarn' | 'node-modules';

export interface BrowserPackageSource {
  type: BrowserPackageSourceType;
  label: string;
  indexedAt: number;
}

export interface BrowserDependencyRecord {
  dep_name: string;
  dep_version: string;
  dep_type: 'runtime' | 'dev' | 'peer' | 'optional';
}

export interface BrowserDependentRecord {
  name: string;
  version: string;
  dep_version: string;
  dep_type: string;
}

export interface BrowserCategoryRecord {
  category_slug: string;
  category_name: string;
  type: string;
}

export interface BrowserIndexStats {
  totalPackages: number;
  uniquePackages: number;
  totalDependencies: number;
  totalSize: number;
  lastIndexedAt: number | null;
  storeName: string | null;
  persisted: boolean;
}

export interface BrowserSearchResultItem {
  name: string;
  latestVersion: string;
  versions: string[];
  description: string | null;
  keywords: string[];
  license: string | null;
}

export interface BrowserSearchResponse {
  query: string;
  count: number;
  results: BrowserSearchResultItem[];
}

export interface BrowserPackageDetail extends BrowserPackageRecord {
  versions: Array<{ id: number; version: string }>;
  categories: BrowserCategoryRecord[];
  dependenciesByType: {
    runtime: BrowserDependencyRecord[];
    dev: BrowserDependencyRecord[];
    peer: BrowserDependencyRecord[];
    optional: BrowserDependencyRecord[];
  };
}

export interface BrowserDependentsResponse {
  package: string;
  count: number;
  dependents: BrowserDependentRecord[];
}
