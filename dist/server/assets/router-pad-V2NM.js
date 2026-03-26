import { s as searchPackages } from "./packages.functions-QW2bgeai.js";
import { t as Route$1 } from "./routes-C7J-8vdF.js";
import { t as Route$2 } from "./package._name-BGfg1iik.js";
import { t as Route$3 } from "./category._slug-DRtwfSbM.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { HeadContent, Link, Outlet, Scripts, createRootRoute, createRouter as createRouter$1, useNavigate, useRouter } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/components/RootDocument.tsx
function RootDocument({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }), /* @__PURE__ */ jsxs("body", { children: [children, /* @__PURE__ */ jsx(Scripts, {})] })]
	});
}
//#endregion
//#region src/components/NotFound.tsx
function NotFound() {
	const path = useRouter().state.location.pathname;
	return /* @__PURE__ */ jsx("main", {
		className: "not-found",
		children: /* @__PURE__ */ jsxs("div", {
			className: "not-found-inner",
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "not-found-code",
					children: "404"
				}),
				/* @__PURE__ */ jsx("h1", {
					className: "not-found-title",
					children: "Not found"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "not-found-path",
					children: /* @__PURE__ */ jsx("code", { children: path })
				}),
				/* @__PURE__ */ jsx("div", {
					className: "not-found-actions",
					children: /* @__PURE__ */ jsx(Link, {
						to: "/",
						className: "not-found-link",
						children: "Browse packages"
					})
				})
			]
		})
	});
}
//#endregion
//#region src/styles/global.css?url
var global_default = "/assets/global-C0HCOVD8.css";
//#endregion
//#region src/routes/__root.tsx
var Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1.0"
			},
			{ title: "Package Explorer — Offline PNPM Browser" }
		],
		links: [
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,300&family=IBM+Plex+Mono:wght@400;500&display=swap"
			},
			{
				rel: "stylesheet",
				href: global_default
			}
		]
	}),
	shellComponent: RootDocument,
	component: RootLayout,
	notFoundComponent: NotFound
});
function highlightMatch(text, query) {
	if (!query) return text;
	const idx = text.toLowerCase().indexOf(query.toLowerCase());
	if (idx === -1) return text;
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		text.slice(0, idx),
		/* @__PURE__ */ jsx("mark", {
			className: "search-match",
			children: text.slice(idx, idx + query.length)
		}),
		text.slice(idx + query.length)
	] });
}
function RootLayout() {
	const navigate = useNavigate();
	const [searchResults, setSearchResults] = useState(null);
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	const debounceRef = useRef(null);
	const inputRef = useRef(null);
	const queryRef = useRef("");
	useEffect(() => {
		const handleGlobalKey = (e) => {
			if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
				e.preventDefault();
				inputRef.current?.focus();
			}
		};
		document.addEventListener("keydown", handleGlobalKey);
		return () => document.removeEventListener("keydown", handleGlobalKey);
	}, []);
	useEffect(() => {
		console.log("%c[ PACKAGE EXPLORER ]%c\nBuilt with TanStack Start + SQLite FTS5\n9,855 packages indexed from your local pnpm store", "font-weight:bold;font-size:14px;font-family:monospace", "font-family:monospace;color:#8a8a94");
	}, []);
	const handleSearch = useCallback((e) => {
		const q = e.target.value.trim();
		queryRef.current = q;
		if (debounceRef.current) clearTimeout(debounceRef.current);
		if (!q) {
			setSearchResults(null);
			setIsSearchOpen(false);
			setActiveIndex(-1);
			return;
		}
		setIsSearchOpen(true);
		debounceRef.current = setTimeout(async () => {
			setSearchResults(await searchPackages({ data: {
				q,
				limit: 8
			} }));
			setActiveIndex(-1);
		}, 150);
	}, []);
	const dismiss = useCallback(() => {
		setSearchResults(null);
		setIsSearchOpen(false);
		setActiveIndex(-1);
		if (inputRef.current) inputRef.current.value = "";
		queryRef.current = "";
	}, []);
	const selectResult = useCallback((name) => {
		dismiss();
		navigate({
			to: "/package/$name",
			params: { name }
		});
	}, [dismiss, navigate]);
	const handleKeyDown = useCallback((e) => {
		const results = searchResults?.results;
		if (!results?.length) {
			if (e.key === "Escape") {
				dismiss();
				inputRef.current?.blur();
			}
			return;
		}
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setActiveIndex((prev) => prev < results.length - 1 ? prev + 1 : 0);
				break;
			case "ArrowUp":
				e.preventDefault();
				setActiveIndex((prev) => prev > 0 ? prev - 1 : results.length - 1);
				break;
			case "Enter":
				e.preventDefault();
				if (activeIndex >= 0 && activeIndex < results.length) selectResult(results[activeIndex].name);
				break;
			case "Escape":
				dismiss();
				inputRef.current?.blur();
				break;
		}
	}, [
		searchResults,
		activeIndex,
		dismiss,
		selectResult
	]);
	return /* @__PURE__ */ jsxs("div", {
		className: "app",
		children: [
			/* @__PURE__ */ jsx("nav", {
				className: "site-header",
				children: /* @__PURE__ */ jsxs("div", {
					className: "site-header-inner",
					children: [/* @__PURE__ */ jsx(Link, {
						to: "/",
						className: "site-logo",
						onClick: dismiss,
						children: "Package Explorer"
					}), /* @__PURE__ */ jsxs("div", {
						className: "header-search-wrap",
						role: "combobox",
						"aria-expanded": isSearchOpen,
						"aria-haspopup": "listbox",
						children: [/* @__PURE__ */ jsx("input", {
							ref: inputRef,
							type: "text",
							className: "header-search-input",
							placeholder: "Search packages...",
							onChange: handleSearch,
							onKeyDown: handleKeyDown,
							onFocus: (e) => {
								if (e.target.value.trim()) setIsSearchOpen(true);
							},
							role: "searchbox",
							"aria-autocomplete": "list",
							"aria-activedescendant": activeIndex >= 0 ? `search-result-${activeIndex}` : void 0
						}), isSearchOpen && searchResults && /* @__PURE__ */ jsx("div", {
							className: "search-dropdown",
							role: "listbox",
							children: searchResults.count === 0 ? /* @__PURE__ */ jsx("div", {
								className: "search-dropdown-empty",
								children: "No results"
							}) : /* @__PURE__ */ jsxs(Fragment, { children: [
								searchResults.results.map((pkg, i) => /* @__PURE__ */ jsxs(Link, {
									id: `search-result-${i}`,
									to: "/package/$name",
									params: { name: pkg.name },
									className: `search-dropdown-item ${i === activeIndex ? "search-dropdown-active" : ""}`,
									onClick: dismiss,
									role: "option",
									"aria-selected": i === activeIndex,
									children: [
										/* @__PURE__ */ jsx("span", {
											className: "search-dropdown-name",
											children: highlightMatch(pkg.name, queryRef.current)
										}),
										/* @__PURE__ */ jsx("span", {
											className: "search-dropdown-ver",
											children: pkg.version
										}),
										pkg.description && /* @__PURE__ */ jsx("span", {
											className: "search-dropdown-desc",
											children: pkg.description
										})
									]
								}, `${pkg.name}-${pkg.id}`)),
								searchResults.count > 8 && /* @__PURE__ */ jsxs("div", {
									className: "search-dropdown-more",
									children: [searchResults.count - 8, " more results · refine your search"]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "search-dropdown-hint",
									children: [
										/* @__PURE__ */ jsx("kbd", { children: "↑" }),
										/* @__PURE__ */ jsx("kbd", { children: "↓" }),
										" navigate",
										/* @__PURE__ */ jsx("kbd", { children: "↵" }),
										" select",
										/* @__PURE__ */ jsx("kbd", { children: "esc" }),
										" close"
									]
								})
							] })
						})]
					})]
				})
			}),
			isSearchOpen && /* @__PURE__ */ jsx("div", {
				className: "search-overlay",
				onClick: dismiss
			}),
			/* @__PURE__ */ jsx(Outlet, {})
		]
	});
}
//#endregion
//#region src/routeTree.gen.ts
var IndexRoute = Route$1.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route
});
var PackageNameRoute = Route$2.update({
	id: "/package/$name",
	path: "/package/$name",
	getParentRoute: () => Route
});
var rootRouteChildren = {
	IndexRoute,
	CategorySlugRoute: Route$3.update({
		id: "/category/$slug",
		path: "/category/$slug",
		getParentRoute: () => Route
	}),
	PackageNameRoute
};
var routeTree = Route._addFileChildren(rootRouteChildren)._addFileTypes();
//#endregion
//#region src/router.tsx
function createRouter() {
	return createRouter$1({
		routeTree,
		scrollRestoration: true,
		defaultNotFoundComponent: NotFound
	});
}
function getRouter() {
	return createRouter();
}
//#endregion
export { createRouter, getRouter };
