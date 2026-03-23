import { readFile, writeFile, mkdir } from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { log } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GENERATED_DIR = join(ROOT, "generated");
const BATCH_SIZE = 50;

function cleanDir(dir) {
  try {
    execSync(`rm -rf "${dir}"`, { timeout: 30_000 });
  } catch {}
}

function setupTmpDir(dir, deps) {
  cleanDir(dir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "offline-fetch-tmp",
      version: "0.0.0",
      private: true,
      dependencies: deps,
    })
  );
}

async function main() {
  const allFile = join(GENERATED_DIR, "all-packages.json");
  let data;
  try {
    data = JSON.parse(await readFile(allFile, "utf-8"));
  } catch {
    console.error(
      "No generated/all-packages.json found. Run discover.js first."
    );
    process.exit(1);
  }

  // Load existing results to support resuming
  const resultsDir = join(ROOT, "results");
  await mkdir(resultsDir, { recursive: true });
  const resultsFile = join(resultsDir, "fetch-results.json");
  let results = { success: [], failed: [] };
  try {
    results = JSON.parse(await readFile(resultsFile, "utf-8"));
    log(`Resuming: ${results.success.length} already succeeded, ${results.failed.length} previously failed`);
  } catch {}

  const alreadyDone = new Set([...results.success, ...results.failed]);
  const packages = data.packages.filter((p) => !alreadyDone.has(p));

  if (packages.length === 0) {
    log("All packages already processed. Nothing to do.");
    return;
  }

  log(`Fetching ${packages.length} remaining packages into pnpm store (${alreadyDone.size} already done)`);

  const tmpDir = join(ROOT, ".tmp-fetch");

  // Split packages into batches
  const batches = [];
  for (let i = 0; i < packages.length; i += BATCH_SIZE) {
    batches.push(packages.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    log(`Batch ${i + 1}/${batches.length} (${batch.length} packages)`);

    const deps = {};
    for (const pkg of batch) {
      deps[pkg] = "latest";
    }

    setupTmpDir(tmpDir, deps);

    try {
      execSync("pnpm install --no-frozen-lockfile", {
        cwd: tmpDir,
        stdio: "pipe",
        timeout: 300_000,
      });
      results.success.push(...batch);
      log(`  Batch ${i + 1} succeeded (${batch.length} packages)`);
    } catch {
      log(`  Batch ${i + 1} failed, falling back to individual installs`);

      for (const pkg of batch) {
        setupTmpDir(tmpDir, { [pkg]: "latest" });

        try {
          execSync("pnpm install --no-frozen-lockfile", {
            cwd: tmpDir,
            stdio: "pipe",
            timeout: 120_000,
          });
          results.success.push(pkg);
        } catch {
          log(`    Failed: ${pkg}`);
          results.failed.push(pkg);
        }
      }
    }

    // Save progress after each batch
    await writeFile(resultsFile, JSON.stringify(results, null, 2));
  }

  // Final cleanup
  cleanDir(tmpDir);

  log(`\nFetch complete:`);
  log(`  Success: ${results.success.length}`);
  log(`  Failed:  ${results.failed.length}`);

  if (results.failed.length > 0) {
    log(`  Failed packages: ${results.failed.join(", ")}`);
  }
}

main().catch((err) => {
  console.error("Fetch failed:", err);
  process.exit(1);
});
