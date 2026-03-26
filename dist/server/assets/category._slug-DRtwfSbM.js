import { n as getCategoryDetail } from "./packages.functions-QW2bgeai.js";
import { createFileRoute, lazyRouteComponent, notFound } from "@tanstack/react-router";
//#region src/routes/category.$slug.tsx
var $$splitComponentImporter = () => import("./category._slug-C6H_sy28.js");
var Route = createFileRoute("/category/$slug")({
	loader: async ({ params }) => {
		const category = await getCategoryDetail({ data: params.slug });
		if (!category) throw notFound();
		return category;
	},
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
