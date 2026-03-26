import { a as getPackageDetail, i as getDependents, o as getPackageVersions } from "./packages.functions-QW2bgeai.js";
import { createFileRoute, lazyRouteComponent, notFound } from "@tanstack/react-router";
//#region src/routes/package.$name.tsx
var $$splitComponentImporter = () => import("./package._name-BT093lnQ.js");
var Route = createFileRoute("/package/$name")({
	validateSearch: (search) => ({ v: typeof search.v === "string" ? search.v : void 0 }),
	loaderDeps: ({ search }) => ({ version: search.v }),
	loader: async ({ params, deps }) => {
		const [pkg, dependents, versions] = await Promise.all([
			getPackageDetail({ data: {
				name: params.name,
				version: deps.version
			} }),
			getDependents({ data: params.name }),
			getPackageVersions({ data: params.name })
		]);
		if (!pkg) throw notFound();
		return {
			pkg,
			dependents,
			versions
		};
	},
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
