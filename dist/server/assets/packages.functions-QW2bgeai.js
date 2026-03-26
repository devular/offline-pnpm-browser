import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "../server.js";
//#region node_modules/.pnpm/@tanstack+start-server-core@1.167.2/node_modules/@tanstack/start-server-core/dist/esm/createSsrRpc.js
var createSsrRpc = (functionId, importer) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (importer ? await importer() : await getServerFnById(functionId))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
//#endregion
//#region src/lib/packages.functions.ts
var getCategories = createServerFn({ method: "GET" }).handler(createSsrRpc("2f90cce3bd72cc87be12acc92df61f7e770404304daf1c51b7e4a1914e7d2400"));
var getCategoryDetail = createServerFn({ method: "GET" }).inputValidator((slug) => slug).handler(createSsrRpc("df64fca21397597a7ee29855c3b153753f3683f4358f19393978070e415493ef"));
var searchPackages = createServerFn({ method: "GET" }).inputValidator((input) => input).handler(createSsrRpc("5195994a82d9f13c1bf8ee88ac03a8f994fba33e706c292808d837faceec435b"));
var getPackageDetail = createServerFn({ method: "GET" }).inputValidator((input) => input).handler(createSsrRpc("21b4ed27efbf051ff1307fb82e31422c7e3cfc98dd52b303d84730bb7404a059"));
var getDependents = createServerFn({ method: "GET" }).inputValidator((name) => name).handler(createSsrRpc("80bd4c64d1aa9ca210163ac8a233631ea938ab40660a6922d84ac1da78fe5526"));
var getPackageVersions = createServerFn({ method: "GET" }).inputValidator((name) => name).handler(createSsrRpc("72819aefc8657151371f6a73df7ec1161c8d91bb03e9ecaec39724416b029e3e"));
var getDbStats = createServerFn({ method: "GET" }).handler(createSsrRpc("d3a5312132b52da2c67ad8cfa3847698cb76f89d7745b6928f9aced9e63bc785"));
//#endregion
export { getPackageDetail as a, getDependents as i, getCategoryDetail as n, getPackageVersions as o, getDbStats as r, searchPackages as s, getCategories as t };
