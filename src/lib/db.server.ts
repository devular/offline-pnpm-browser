import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const DB_PATH = resolve(ROOT, 'packages.db');
const GENERATED = resolve(ROOT, 'generated');

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  if (!existsSync(DB_PATH)) {
    throw new Error(`Database not found at ${DB_PATH}. Run: pnpm run index`);
  }
  _db = new DatabaseSync(DB_PATH, { readOnly: true });
  return _db;
}

export function getGeneratedPath(): string {
  return GENERATED;
}

// --- Query helpers ---

export interface PackageRow {
  id: number;
  name: string;
  version: string;
  description: string | null;
  keywords: string | null;
  readme: string | null;
  license: string | null;
  repository: string | null;
  homepage: string | null;
  author: string | null;
  has_build: number;
  file_count: number;
  total_size: number;
}

export interface DependencyRow {
  dep_name: string;
  dep_version: string;
  dep_type: string;
}

export interface DependentRow {
  name: string;
  version: string;
  dep_version: string;
  dep_type: string;
}

export interface CategoryRow {
  category_slug: string;
  category_name: string;
  type: string;
}

export interface SearchResult {
  id: number;
  name: string;
  version: string;
  description: string | null;
  keywords: string | null;
  license: string | null;
  rank: number;
}

export interface DbStats {
  total_packages: number;
  unique_packages: number;
  total_dependencies: number;
  total_categorized: number;
}
