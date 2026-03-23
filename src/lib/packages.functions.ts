import { createServerFn } from '@tanstack/react-start';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getDb,
  getGeneratedPath,
  type PackageRow,
  type DependencyRow,
  type DependentRow,
  type CategoryRow,
  type SearchResult,
  type DbStats,
} from './db.server';

// --- Categories (from generated JSON) ---

export interface CategorySummary {
  name: string;
  slug: string;
  count: number;
}

export interface CategoriesResponse {
  totalPackages: number;
  categories: CategorySummary[];
}

export const getCategories = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CategoriesResponse> => {
    const data = JSON.parse(
      await readFile(resolve(getGeneratedPath(), 'all-packages.json'), 'utf-8'),
    );
    return {
      totalPackages: data.totalPackages,
      categories: data.categories,
    };
  },
);

// --- Category detail ---

export interface CategoryDetail {
  name: string;
  slug: string;
  curated: string[];
  discovered: string[];
  totalCount: number;
}

export const getCategoryDetail = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<CategoryDetail | null> => {
    const file = resolve(getGeneratedPath(), `${slug}.json`);
    if (!existsSync(file)) return null;
    return JSON.parse(await readFile(file, 'utf-8'));
  });

// --- Search (SQLite FTS5) ---

export interface SearchResponse {
  query: string;
  count: number;
  results: Array<{
    id: number;
    name: string;
    version: string;
    description: string | null;
    keywords: string[];
    license: string | null;
  }>;
}

export const searchPackages = createServerFn({ method: 'GET' })
  .inputValidator((input: { q: string; limit?: number }) => input)
  .handler(async ({ data }): Promise<SearchResponse> => {
    const { q, limit: rawLimit } = data;
    const limit = Math.min(rawLimit ?? 50, 200);
    const db = getDb();

    const sanitized = q
      .trim()
      .split(/\s+/)
      .map((term) => `"${term.replace(/"/g, '')}"`)
      .join(' ');

    try {
      const rows = db
        .prepare(
          `SELECT p.id, p.name, p.version, p.description, p.keywords, p.license, f.rank
         FROM packages_fts f
         JOIN packages p ON p.id = f.rowid
         WHERE packages_fts MATCH ?
         ORDER BY f.rank
         LIMIT ?`,
        )
        .all(sanitized, limit) as SearchResult[];

      return {
        query: q,
        count: rows.length,
        results: rows.map((r) => ({
          id: r.id,
          name: r.name,
          version: r.version,
          description: r.description,
          keywords: r.keywords?.split(', ').filter(Boolean) ?? [],
          license: r.license,
        })),
      };
    } catch {
      const rows = db
        .prepare(
          `SELECT id, name, version, description, keywords, license
         FROM packages WHERE name LIKE ? OR description LIKE ?
         ORDER BY name LIMIT ?`,
        )
        .all(`%${q}%`, `%${q}%`, limit) as SearchResult[];

      return {
        query: q,
        count: rows.length,
        results: rows.map((r) => ({
          id: r.id,
          name: r.name,
          version: r.version,
          description: r.description,
          keywords: r.keywords?.split(', ').filter(Boolean) ?? [],
          license: r.license,
        })),
      };
    }
  });

// --- Package detail ---

export interface PackageDetail {
  id: number;
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
  categories: CategoryRow[];
  dependencies: {
    runtime: DependencyRow[];
    dev: DependencyRow[];
    peer: DependencyRow[];
    optional: DependencyRow[];
  };
}

export const getPackageDetail = createServerFn({ method: 'GET' })
  .inputValidator((input: { name: string; version?: string }) => input)
  .handler(async ({ data: { name, version } }): Promise<PackageDetail | null> => {
    const db = getDb();
    const row = version
      ? (db
          .prepare('SELECT * FROM packages WHERE name = ? AND version = ? LIMIT 1')
          .get(name, version) as PackageRow | undefined)
      : (db.prepare('SELECT * FROM packages WHERE name = ? ORDER BY id DESC LIMIT 1').get(name) as
          | PackageRow
          | undefined);

    if (!row) return null;

    const deps = db
      .prepare(
        'SELECT dep_name, dep_version, dep_type FROM dependencies WHERE package_id = ? ORDER BY dep_type, dep_name',
      )
      .all(row.id) as DependencyRow[];

    const categories = db
      .prepare(
        'SELECT category_slug, category_name, type FROM category_packages WHERE package_id = ?',
      )
      .all(row.id) as CategoryRow[];

    return {
      id: row.id,
      name: row.name,
      version: row.version,
      description: row.description,
      keywords: row.keywords?.split(', ').filter(Boolean) ?? [],
      readme: row.readme,
      license: row.license,
      repository: row.repository,
      homepage: row.homepage,
      author: row.author,
      hasBuild: Boolean(row.has_build),
      fileCount: row.file_count,
      totalSize: row.total_size,
      categories,
      dependencies: {
        runtime: deps.filter((d) => d.dep_type === 'runtime'),
        dev: deps.filter((d) => d.dep_type === 'dev'),
        peer: deps.filter((d) => d.dep_type === 'peer'),
        optional: deps.filter((d) => d.dep_type === 'optional'),
      },
    };
  });

// --- Dependents ---

export interface DependentsResponse {
  package: string;
  count: number;
  dependents: DependentRow[];
}

export const getDependents = createServerFn({ method: 'GET' })
  .inputValidator((name: string) => name)
  .handler(async ({ data: name }): Promise<DependentsResponse> => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT p.name, p.version, d.dep_version, d.dep_type
       FROM dependencies d
       JOIN packages p ON p.id = d.package_id
       WHERE d.dep_name = ?
       ORDER BY p.name`,
      )
      .all(name) as DependentRow[];

    return { package: name, count: rows.length, dependents: rows };
  });

// --- Package versions ---

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export const getPackageVersions = createServerFn({ method: 'GET' })
  .inputValidator((name: string) => name)
  .handler(async ({ data: name }): Promise<Array<{ id: number; version: string }>> => {
    const db = getDb();
    const rows = db
      .prepare('SELECT id, version FROM packages WHERE name = ? ORDER BY id DESC')
      .all(name) as Array<{ id: number; version: string }>;
    return rows.sort((a, b) => compareSemver(a.version, b.version));
  });

// --- DB stats ---

export const getDbStats = createServerFn({ method: 'GET' }).handler(async (): Promise<DbStats> => {
  const db = getDb();
  return db
    .prepare(
      `SELECT
      (SELECT COUNT(*) FROM packages) as total_packages,
      (SELECT COUNT(DISTINCT name) FROM packages) as unique_packages,
      (SELECT COUNT(*) FROM dependencies) as total_dependencies,
      (SELECT COUNT(*) FROM category_packages) as total_categorized`,
    )
    .get() as DbStats;
});
