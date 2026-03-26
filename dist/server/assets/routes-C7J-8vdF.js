import { r as getDbStats, t as getCategories } from "./packages.functions-QW2bgeai.js";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
//#region src/routes/index.tsx
var $$splitComponentImporter = () => import("./routes-CttgNkng.js");
var Route = createFileRoute("/")({
	loader: async () => {
		const [categories, stats] = await Promise.all([getCategories(), getDbStats()]);
		return {
			categories,
			stats
		};
	},
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
