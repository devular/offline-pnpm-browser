import "./packages.functions-QW2bgeai.js";
import { t as Route } from "./routes-C7J-8vdF.js";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/components/CategoryGrid.tsx
function CategoryGrid({ categories }) {
	return /* @__PURE__ */ jsx("section", { children: /* @__PURE__ */ jsx("div", {
		className: "category-grid",
		children: categories.categories.map((cat) => /* @__PURE__ */ jsxs(Link, {
			to: "/category/$slug",
			params: { slug: cat.slug },
			className: "cat-card",
			children: [/* @__PURE__ */ jsx("h3", { children: cat.name }), /* @__PURE__ */ jsxs("span", {
				className: "count",
				children: [cat.count, " packages"]
			})]
		}, cat.slug))
	}) });
}
//#endregion
//#region src/routes/index.tsx?tsr-split=component
function HomePage() {
	const { categories, stats } = Route.useLoaderData();
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("main", {
		className: "home-main",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "home-hero",
			children: [
				/* @__PURE__ */ jsxs("h2", {
					className: "home-title",
					children: [
						"Browse ",
						stats.unique_packages.toLocaleString(),
						" packages"
					]
				}),
				/* @__PURE__ */ jsx("p", {
					className: "home-subtitle",
					children: "Your local pnpm store, indexed and searchable. Browse READMEs, trace dependency graphs, and install packages offline — all from cached data, no network required."
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "home-stats",
					children: [
						/* @__PURE__ */ jsxs("span", { children: [stats.total_packages.toLocaleString(), " versions"] }),
						/* @__PURE__ */ jsxs("span", { children: [stats.total_dependencies.toLocaleString(), " dependencies"] }),
						/* @__PURE__ */ jsxs("span", { children: [stats.total_categorized, " categorized"] })
					]
				})
			]
		}), /* @__PURE__ */ jsx(CategoryGrid, { categories })]
	}), /* @__PURE__ */ jsxs("footer", {
		className: "status-bar",
		children: [
			stats.total_packages.toLocaleString(),
			" total versions ·",
			" ",
			stats.unique_packages.toLocaleString(),
			" unique packages · ",
			stats.total_categorized,
			" ",
			"categorized"
		]
	})] });
}
//#endregion
export { HomePage as component };
