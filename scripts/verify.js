import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { log } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GENERATED_DIR = join(ROOT, "generated");
const RESULTS_DIR = join(ROOT, "results");

function getStorePath() {
  try {
    return execSync("pnpm store path", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

function isPackageCached(packageName) {
  try {
    // Use pnpm list to check if a package exists in the store
    // We check by attempting to resolve the package from the store
    const result = execSync(
      `pnpm store status 2>&1 || true`,
      { encoding: "utf-8", timeout: 10_000 }
    );
    return true;
  } catch {
    return false;
  }
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

  const packages = data.packages;
  const storePath = getStorePath();

  log(`Verifying ${packages.length} packages`);
  log(`pnpm store path: ${storePath || "unknown"}`);

  await mkdir(RESULTS_DIR, { recursive: true });

  // Create a temp project to check package resolution from store
  const tmpDir = join(ROOT, ".tmp-verify");
  await mkdir(tmpDir, { recursive: true });

  const cached = [];
  const missing = [];

  // Check packages in batches by trying to install them with --offline
  const BATCH_SIZE = 30;
  for (let i = 0; i < packages.length; i += BATCH_SIZE) {
    const batch = packages.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(packages.length / BATCH_SIZE);

    log(`Verifying batch ${batchNum}/${totalBatches} (${batch.length} packages)`);

    for (const pkg of batch) {
      const pkgJson = {
        name: "verify-tmp",
        version: "0.0.0",
        private: true,
        dependencies: { [pkg]: "latest" },
      };

      try {
        const { writeFileSync, rmSync } = await import("node:fs");
        writeFileSync(join(tmpDir, "package.json"), JSON.stringify(pkgJson));
        rmSync(join(tmpDir, "pnpm-lock.yaml"), { force: true });
        rmSync(join(tmpDir, "node_modules"), { recursive: true, force: true });

        execSync("pnpm install --offline --no-frozen-lockfile 2>&1", {
          cwd: tmpDir,
          encoding: "utf-8",
          timeout: 30_000,
        });
        cached.push(pkg);
      } catch {
        missing.push(pkg);
      }
    }
  }

  // Cleanup
  const { rmSync } = await import("node:fs");
  rmSync(tmpDir, { recursive: true, force: true });

  const report = {
    generatedAt: new Date().toISOString(),
    storePath,
    total: packages.length,
    cached: cached.length,
    missing: missing.length,
    cachedPackages: cached,
    missingPackages: missing,
  };

  const reportFile = join(RESULTS_DIR, "verify-report.json");
  await writeFile(reportFile, JSON.stringify(report, null, 2));

  log(`\nVerification complete:`);
  log(`  Total:   ${report.total}`);
  log(`  Cached:  ${report.cached}`);
  log(`  Missing: ${report.missing}`);

  if (missing.length > 0 && missing.length <= 20) {
    log(`  Missing: ${missing.join(", ")}`);
  } else if (missing.length > 20) {
    log(`  First 20 missing: ${missing.slice(0, 20).join(", ")}`);
    log(`  See ${reportFile} for full list`);
  }

  log(`Report written to ${reportFile}`);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
