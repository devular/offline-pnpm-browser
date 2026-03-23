import { execSync } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BACKUPS_DIR = join(ROOT, "backups");

function getStorePath() {
  return execSync("pnpm store path", { encoding: "utf-8" }).trim();
}

async function listBackups() {
  let files;
  try {
    files = await readdir(BACKUPS_DIR);
  } catch {
    console.error("No backups directory found.");
    process.exit(1);
  }

  const backups = files
    .filter((f) => f.startsWith("pnpm-store-") && f.endsWith(".tar.gz"))
    .sort()
    .reverse();

  if (backups.length === 0) {
    console.error("No backups found in backups/");
    process.exit(1);
  }

  return backups;
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--list" || args[0] === "-l") {
    const backups = await listBackups();
    console.log("Available backups:");
    for (const b of backups) {
      const info = await stat(join(BACKUPS_DIR, b));
      const sizeMB = (info.size / 1024 / 1024).toFixed(1);
      console.log(`  ${b}  (${sizeMB} MB)`);
    }
    return;
  }

  const storePath = getStorePath();
  const storeParent = dirname(storePath);

  // Use specified backup or latest
  let archiveName;
  if (args[0]) {
    archiveName = args[0];
  } else {
    const backups = await listBackups();
    archiveName = backups[0];
    log(`No backup specified, using latest: ${archiveName}`);
  }

  const archivePath = join(BACKUPS_DIR, archiveName);
  try {
    await stat(archivePath);
  } catch {
    console.error(`Backup not found: ${archivePath}`);
    process.exit(1);
  }

  log(`Restoring pnpm store`);
  log(`  Source: ${archivePath}`);
  log(`  Target: ${storeParent}`);

  execSync(`tar -xzf "${archivePath}" -C "${storeParent}"`, {
    stdio: "inherit",
    timeout: 600_000,
  });

  log("Restore complete");
}

main().catch((err) => {
  console.error("Restore failed:", err);
  process.exit(1);
});
