import "./packages.functions-QW2bgeai.js";
import { t as Route } from "./category._slug-DRtwfSbM.js";
import { t as Badge } from "./Badge-BOYMoAJe.js";
import { Link } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/components/PackageSection.tsx
function PackageSection({ title, packages, type }) {
	return /* @__PURE__ */ jsxs("section", {
		className: "pkg-section",
		children: [/* @__PURE__ */ jsxs("h4", { children: [
			title,
			" (",
			packages.length,
			")"
		] }), packages.map((name) => /* @__PURE__ */ jsxs(Link, {
			to: "/package/$name",
			params: { name },
			className: "pkg-item",
			children: [/* @__PURE__ */ jsx(Badge, {
				variant: type,
				children: type
			}), /* @__PURE__ */ jsx("span", {
				className: "pkg-name",
				children: name
			})]
		}, name))]
	});
}
//#endregion
//#region src/routes/category.$slug.tsx?tsr-split=component
function CategoryPage() {
	const category = Route.useLoaderData();
	return /* @__PURE__ */ jsxs("main", {
		className: "page-content",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "page-title-row",
				children: [
					/* @__PURE__ */ jsx(Link, {
						to: "/",
						className: "breadcrumb-link",
						children: "Categories"
					}),
					/* @__PURE__ */ jsx("span", {
						className: "breadcrumb-sep",
						children: "/"
					}),
					/* @__PURE__ */ jsx("h1", {
						className: "page-title",
						children: category.name
					}),
					/* @__PURE__ */ jsxs("span", {
						className: "page-count",
						children: [category.totalCount, " packages"]
					})
				]
			}),
			category.curated.length > 0 && /* @__PURE__ */ jsx(PackageSection, {
				title: "Curated",
				packages: category.curated,
				type: "curated"
			}),
			category.discovered.length > 0 && /* @__PURE__ */ jsx(PackageSection, {
				title: "Discovered",
				packages: category.discovered,
				type: "discovered"
			})
		]
	});
}
//#endregion
export { CategoryPage as component };
