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
  indexedAt: number;
  sourceMtime: number;
  searchText: string;
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
}
