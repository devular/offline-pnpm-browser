import allPackages from '@generated/all-packages.json';

interface GeneratedCategorySummary {
  name: string;
  slug: string;
  count: number;
}

interface GeneratedCategoryDetail {
  name: string;
  slug: string;
  curated: string[];
  discovered: string[];
  totalCount: number;
}

export interface CategorySummary {
  name: string;
  slug: string;
  count: number;
}

export interface CategoriesResponse {
  totalPackages: number;
  categories: CategorySummary[];
}

export interface CategoryDetail {
  name: string;
  slug: string;
  curated: string[];
  discovered: string[];
  totalCount: number;
}

const categoryModules = import.meta.glob('@generated/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, GeneratedCategoryDetail | typeof allPackages>;

export function getBrowserCategories(): CategoriesResponse {
  return {
    totalPackages: allPackages.totalPackages,
    categories: allPackages.categories as GeneratedCategorySummary[],
  };
}

export function getBrowserCategoryDetail(slug: string): CategoryDetail | null {
  const entry = categoryModules[`/generated/${slug}.json`];
  if (!entry || !('curated' in entry)) return null;
  return entry;
}

export function getBrowserCategoriesForPackage(name: string) {
  const categories = getBrowserCategories().categories;
  const matches: Array<{ category_slug: string; category_name: string; type: string }> = [];

  for (const category of categories) {
    const detail = getBrowserCategoryDetail(category.slug);
    if (!detail) continue;
    if (detail.curated.includes(name)) {
      matches.push({
        category_slug: detail.slug,
        category_name: detail.name,
        type: 'curated',
      });
    } else if (detail.discovered.includes(name)) {
      matches.push({
        category_slug: detail.slug,
        category_name: detail.name,
        type: 'discovered',
      });
    }
  }

  return matches;
}
