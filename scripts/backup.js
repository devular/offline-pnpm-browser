import { execSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BACKUPS_DIR = join(ROOT, "backups");

function getStorePath() {
  return execSync("pnpm store path", { encoding: "utf-8" }).trim();
}

async function main() {
  const storePath = getStorePath();
  await mkdir(BACKUPS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const archiveName = `pnpm-store-${timestamp}.tar.gz`;
  const archivePath = join(BACKUPS_DIR, archiveName);

  log(`Backing up pnpm store`);
  log(`  Source: ${storePath}`);
  log(`  Target: ${archivePath}`);

  const storeParent = dirname(storePath);
  const storeBase = storePath.split("/").pop();

  execSync(
    `tar -czf "${archivePath}" -C "${storeParent}" "${storeBase}"`,
    { stdio: "inherit", timeout: 600_000 }
  );

  const sizeBytes = execSync(`stat -f%z "${archivePath}"`, { encoding: "utf-8" }).trim();
  const sizeMB = (parseInt(sizeBytes, 10) / 1024 / 1024).toFixed(1);

  log(`Backup complete: ${archiveName} (${sizeMB} MB)`);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
