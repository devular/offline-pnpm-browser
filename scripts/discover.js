import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchNpmSearch, delay, log } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GENERATED_DIR = join(ROOT, "generated");
const MIN_WEEKLY_DOWNLOADS = 1000;

async function main() {
  const categories = JSON.parse(
    await readFile(join(ROOT, "categories.json"), "utf-8")
  );

  await mkdir(GENERATED_DIR, { recursive: true });

  const allPackages = new Set();
  const categoryResults = [];

  for (const category of categories) {
    log(`Processing category: ${category.name}`);

    const curated = new Set(category.curated);
    const discovered = new Set();

    // Search npm registry for each keyword
    for (const keyword of category.keywords) {
      log(`  Searching: "${keyword}"`);
      const results = await fetchNpmSearch(keyword, category.maxFromSearch || 20);

      for (const result of results) {
        const pkg = result.package;
        if (!pkg || !pkg.name) continue;

        // Skip if already curated
        if (curated.has(pkg.name)) continue;

        // Skip deprecated packages
        if (pkg.deprecated) continue;

        // Skip packages with low downloads (use score as proxy if no download count)
        // The search API doesn't directly return downloads, but we can filter by score
        const popularity = result.score?.detail?.popularity ?? 0;
        if (popularity < 0.01) continue;

        discovered.add(pkg.name);
      }

      // Rate limit between API calls
      await delay(200);
    }

    const merged = [...curated, ...discovered];
    merged.forEach((p) => allPackages.add(p));

    const categoryData = {
      name: category.name,
      slug: category.slug,
      curated: [...curated],
      discovered: [...discovered],
      all: merged,
      totalCount: merged.length,
    };

    categoryResults.push(categoryData);

    // Write per-category file
    const categoryFile = join(GENERATED_DIR, `${category.slug}.json`);
    await writeFile(categoryFile, JSON.stringify(categoryData, null, 2));
    log(`  Wrote ${categoryFile} (${merged.length} packages)`);
  }

  // Write combined file
  const allPackagesData = {
    generatedAt: new Date().toISOString(),
    totalPackages: allPackages.size,
    packages: [...allPackages].sort(),
    categories: categoryResults.map((c) => ({
      name: c.name,
      slug: c.slug,
      count: c.totalCount,
    })),
  };

  const allFile = join(GENERATED_DIR, "all-packages.json");
  await writeFile(allFile, JSON.stringify(allPackagesData, null, 2));
  log(`Wrote ${allFile} (${allPackages.size} total unique packages)`);
}

main().catch((err) => {
  console.error("Discovery failed:", err);
  process.exit(1);
});
