import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "../server.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Fuse from "fuse.js";
import { DatabaseSync } from "node:sqlite";
//#region node_modules/.pnpm/@tanstack+start-server-core@1.167.2/node_modules/@tanstack/start-server-core/dist/esm/createServerRpc.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
//#endregion
//#region src/lib/db.server.ts
var ROOT = process.cwd();
var DB_PATH = resolve(ROOT, "packages.db");
var GENERATED = resolve(ROOT, "generated");
var _db = null;
function getDb() {
	if (_db) return _db;
	if (!existsSync(DB_PATH)) throw new Error(`Database not found at ${DB_PATH}. Run: pnpm run index`);
	_db = new DatabaseSync(DB_PATH, { readOnly: true });
	return _db;
}
function getGeneratedPath() {
	return GENERATED;
}
//#endregion
//#region src/lib/packages.functions.ts?tss-serverfn-split
var _fuse = null;
function getFuse() {
	if (_fuse) return _fuse;
	_fuse = new Fuse(getDb().prepare("SELECT id, name, version, description, keywords, license FROM packages").all(), {
		keys: [
			{
				name: "name",
				weight: 3
			},
			{
				name: "description",
				weight: 1
			},
			{
				name: "keywords",
				weight: 1.5
			}
		],
		threshold: .4,
		includeScore: true
	});
	return _fuse;
}
var getCategories_createServerFn_handler = createServerRpc({
	id: "2f90cce3bd72cc87be12acc92df61f7e770404304daf1c51b7e4a1914e7d2400",
	name: "getCategories",
	filename: "src/lib/packages.functions.ts"
}, (opts) => getCategories.__executeServer(opts));
var getCategories = createServerFn({ method: "GET" }).handler(getCategories_createServerFn_handler, async () => {
	const data = JSON.parse(await readFile(resolve(getGeneratedPath(), "all-packages.json"), "utf-8"));
	return {
		totalPackages: data.totalPackages,
		categories: data.categories
	};
});
var getCategoryDetail_createServerFn_handler = createServerRpc({
	id: "df64fca21397597a7ee29855c3b153753f3683f4358f19393978070e415493ef",
	name: "getCategoryDetail",
	filename: "src/lib/packages.functions.ts"
}, (opts) => getCategoryDetail.__executeServer(opts));
var getCategoryDetail = createServerFn({ method: "GET" }).inputValidator((slug) => slug).handler(getCategoryDetail_createServerFn_handler, async ({ data: slug }) => {
	const file = resolve(getGeneratedPath(), `${slug}.json`);
	if (!existsSync(file)) return null;
	return JSON.parse(await readFile(file, "utf-8"));
});
var searchPackages_createServerFn_handler = createServerRpc({
	id: "5195994a82d9f13c1bf8ee88ac03a8f994fba33e706c292808d837faceec435b",
	name: "searchPackages",
	filename: "src/lib/packages.functions.ts"
}, (opts) => searchPackages.__executeServer(opts));
var searchPackages = createServerFn({ method: "GET" }).inputValidator((input) => input).handler(searchPackages_createServerFn_handler, async ({ data }) => {
	const { q, limit: rawLimit } = data;
	const limit = Math.min(rawLimit ?? 50, 200);
	const db = getDb();
	const sanitized = q.trim().split(/\s+/).map((term) => `"${term.replace(/"/g, "")}"*`).join(" ");
	const formatRow = (r) => ({
		id: r.id,
		name: r.name,
		version: r.version,
		description: r.description,
		keywords: (r.keywords ?? "").split(", ").filter(Boolean),
		license: r.license
	});
	try {
		const rows = db.prepare(`SELECT p.id, p.name, p.version, p.description, p.keywords, p.license, f.rank
         FROM packages_fts f
         JOIN packages p ON p.id = f.rowid
         WHERE packages_fts MATCH ?
         ORDER BY f.rank
         LIMIT ?`).all(sanitized, limit);
		if (rows.length > 0) return {
			query: q,
			count: rows.length,
			results: rows.map(formatRow)
		};
	} catch {}
	const fuzzyResults = getFuse().search(q, { limit });
	return {
		query: q,
		count: fuzzyResults.length,
		results: fuzzyResults.map((r) => formatRow(r.item))
	};
});
var getPackageDetail_createServerFn_handler = createServerRpc({
	id: "21b4ed27efbf051ff1307fb82e31422c7e3cfc98dd52b303d84730bb7404a059",
	name: "getPackageDetail",
	filename: "src/lib/packages.functions.ts"
}, (opts) => getPackageDetail.__executeServer(opts));
var getPackageDetail = createServerFn({ method: "GET" }).inputValidator((input) => input).handler(getPackageDetail_createServerFn_handler, async ({ data: { name, version } }) => {
	const db = getDb();
	const row = version ? db.prepare("SELECT * FROM packages WHERE name = ? AND version = ? LIMIT 1").get(name, version) : db.prepare("SELECT * FROM packages WHERE name = ? ORDER BY id DESC LIMIT 1").get(name);
	if (!row) return null;
	const deps = db.prepare("SELECT dep_name, dep_version, dep_type FROM dependencies WHERE package_id = ? ORDER BY dep_type, dep_name").all(row.id);
	const categories = db.prepare("SELECT category_slug, category_name, type FROM category_packages WHERE package_id = ?").all(row.id);
	return {
		id: row.id,
		name: row.name,
		version: row.version,
		description: row.description,
		keywords: row.keywords?.split(", ").filter(Boolean) ?? [],
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
			runtime: deps.filter((d) => d.dep_type === "runtime"),
			dev: deps.filter((d) => d.dep_type === "dev"),
			peer: deps.filter((d) => d.dep_type === "peer"),
			optional: deps.filter((d) => d.dep_type === "optional")
		}
	};
});
var getDependents_createServerFn_handler = createServerRpc({
	id: "80bd4c64d1aa9ca210163ac8a233631ea938ab40660a6922d84ac1da78fe5526",
	name: "getDependents",
	filename: "src/lib/packages.functions.ts"
}, (opts) => getDependents.__executeServer(opts));
var getDependents = createServerFn({ method: "GET" }).inputValidator((name) => name).handler(getDependents_createServerFn_handler, async ({ data: name }) => {
	const rows = getDb().prepare(`SELECT p.name, p.version, d.dep_version, d.dep_type
       FROM dependencies d
       JOIN packages p ON p.id = d.package_id
       WHERE d.dep_name = ?
       ORDER BY p.name`).all(name);
	return {
		package: name,
		count: rows.length,
		dependents: rows
	};
});
function compareSemver(a, b) {
	const pa = a.split(".").map(Number);
	const pb = b.split(".").map(Number);
	for (let i = 0; i < 3; i++) {
		const diff = (pb[i] || 0) - (pa[i] || 0);
		if (diff !== 0) return diff;
	}
	return 0;
}
var getPackageVersions_createServerFn_handler = createServerRpc({
	id: "72819aefc8657151371f6a73df7ec1161c8d91bb03e9ecaec39724416b029e3e",
	name: "getPackageVersions",
	filename: "src/lib/packages.functions.ts"
}, (opts) => getPackageVersions.__executeServer(opts));
var getPackageVersions = createServerFn({ method: "GET" }).inputValidator((name) => name).handler(getPackageVersions_createServerFn_handler, async ({ data: name }) => {
	return getDb().prepare("SELECT id, version FROM packages WHERE name = ? ORDER BY id DESC").all(name).sort((a, b) => compareSemver(a.version, b.version));
});
var getDbStats_createServerFn_handler = createServerRpc({
	id: "d3a5312132b52da2c67ad8cfa3847698cb76f89d7745b6928f9aced9e63bc785",
	name: "getDbStats",
	filename: "src/lib/packages.functions.ts"
}, (opts) => getDbStats.__executeServer(opts));
var getDbStats = createServerFn({ method: "GET" }).handler(getDbStats_createServerFn_handler, async () => {
	return getDb().prepare(`SELECT
      (SELECT COUNT(*) FROM packages) as total_packages,
      (SELECT COUNT(DISTINCT name) FROM packages) as unique_packages,
      (SELECT COUNT(*) FROM dependencies) as total_dependencies,
      (SELECT COUNT(*) FROM category_packages) as total_categorized`).get();
});
//#endregion
export { getCategories_createServerFn_handler, getCategoryDetail_createServerFn_handler, getDbStats_createServerFn_handler, getDependents_createServerFn_handler, getPackageDetail_createServerFn_handler, getPackageVersions_createServerFn_handler, searchPackages_createServerFn_handler };
