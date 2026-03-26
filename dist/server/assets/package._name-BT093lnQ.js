import "./packages.functions-QW2bgeai.js";
import { t as Route } from "./package._name-BGfg1iik.js";
import { t as Badge } from "./Badge-BOYMoAJe.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { marked } from "marked";
import { highlight } from "sugar-high";
//#region src/hooks/useCopy.ts
function useCopy(resetMs = 2e3) {
	const [status, setStatus] = useState("idle");
	const timerRef = useRef(null);
	return {
		copy: useCallback(async (text) => {
			try {
				await navigator.clipboard.writeText(text);
				setStatus("copied");
			} catch {
				setStatus("error");
			}
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => setStatus("idle"), resetMs);
		}, [resetMs]),
		status,
		copied: status === "copied"
	};
}
//#endregion
//#region src/components/InstallCommand.tsx
function InstallCommand({ name, version }) {
	const cmd = `pnpm add ${name}@${version} --offline`;
	const { copy, copied } = useCopy();
	return /* @__PURE__ */ jsxs("div", {
		className: "install-cmd",
		onClick: () => copy(cmd),
		children: [/* @__PURE__ */ jsxs("code", {
			className: "install-cmd-text",
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "install-cmd-prompt",
					children: "$"
				}),
				" ",
				cmd
			]
		}), /* @__PURE__ */ jsx("span", {
			className: `install-cmd-action ${copied ? "install-cmd-copied" : ""}`,
			children: copied ? "Copied" : "Click to copy"
		})]
	});
}
//#endregion
//#region src/components/VersionSelector.tsx
function VersionSelector({ currentVersion, versions, packageName }) {
	const navigate = useNavigate();
	if (versions.length <= 1) return /* @__PURE__ */ jsx("span", {
		className: "pkg-ver",
		children: currentVersion
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "version-select-wrap",
		children: [/* @__PURE__ */ jsx("select", {
			className: "version-select",
			value: currentVersion,
			onChange: (e) => {
				const newVersion = e.target.value;
				navigate({
					to: "/package/$name",
					params: { name: packageName },
					search: { v: newVersion }
				});
			},
			"aria-label": "Package version",
			children: versions.map((v) => /* @__PURE__ */ jsx("option", {
				value: v.version,
				children: v.version
			}, v.id))
		}), /* @__PURE__ */ jsxs("span", {
			className: "version-count",
			children: [versions.length, " versions"]
		})]
	});
}
//#endregion
//#region src/components/Collapsible.tsx
function Collapsible({ title, count, defaultOpen = true, children }) {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	return /* @__PURE__ */ jsxs("div", {
		className: "deps-group",
		children: [/* @__PURE__ */ jsxs("h3", {
			className: "section-toggle",
			onClick: () => setIsOpen(!isOpen),
			children: [
				/* @__PURE__ */ jsx("span", {
					className: `toggle-arrow ${isOpen ? "open" : ""}`,
					children: "▶"
				}),
				title,
				" (",
				count,
				")"
			]
		}), isOpen && children]
	});
}
//#endregion
//#region src/components/DepItem.tsx
function DepItem({ name, version, type }) {
	return /* @__PURE__ */ jsxs(Link, {
		to: "/package/$name",
		params: { name },
		className: "dep-item",
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "dep-name",
				children: name
			}),
			/* @__PURE__ */ jsx("span", {
				className: "dep-version",
				children: version
			}),
			type && /* @__PURE__ */ jsx(Badge, {
				variant: "dep-type",
				children: type
			})
		]
	});
}
//#endregion
//#region src/components/DepsSection.tsx
function DepsSection({ title, deps, defaultOpen = true }) {
	if (deps.length === 0) return null;
	return /* @__PURE__ */ jsx(Collapsible, {
		title,
		count: deps.length,
		defaultOpen,
		children: /* @__PURE__ */ jsx("div", {
			className: "dep-list",
			children: deps.map((dep) => /* @__PURE__ */ jsx(DepItem, {
				name: dep.dep_name,
				version: dep.dep_version
			}, dep.dep_name))
		})
	});
}
//#endregion
//#region src/components/CollapsibleDependents.tsx
function CollapsibleDependents({ dependents }) {
	const [showAll, setShowAll] = useState(false);
	if (dependents.count === 0) return null;
	const visible = showAll ? dependents.dependents : dependents.dependents.slice(0, 20);
	return /* @__PURE__ */ jsx(Collapsible, {
		title: "Dependents",
		count: dependents.count,
		defaultOpen: dependents.count <= 15,
		children: /* @__PURE__ */ jsxs("div", {
			className: "dep-list",
			children: [visible.map((dep, i) => /* @__PURE__ */ jsx(DepItem, {
				name: dep.name,
				version: dep.dep_version,
				type: dep.dep_type
			}, `${dep.name}-${i}`)), !showAll && dependents.dependents.length > 20 && /* @__PURE__ */ jsxs("button", {
				className: "show-more-btn",
				onClick: () => setShowAll(true),
				children: [
					"Show all ",
					dependents.count,
					" dependents"
				]
			})]
		})
	});
}
//#endregion
//#region src/routes/package.$name.tsx?tsr-split=component
function cleanAuthor(author) {
	return author.replace(/<[^>]+>/g, "").replace(/\([^)]+\)/g, "").trim();
}
function formatBytes(bytes) {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = [
		"B",
		"KB",
		"MB",
		"GB"
	];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
function repoDisplayUrl(url) {
	const cleaned = url.replace(/^git\+/, "").replace(/\.git$/, "");
	if (/github\.com/.test(cleaned)) return cleaned.replace(/^https?:\/\/github\.com\//, "");
	return cleaned.replace(/^https?:\/\//, "");
}
function repoHref(url) {
	return url.replace(/^git\+/, "").replace(/\.git$/, "");
}
function buildReadmeHtml(readme) {
	try {
		let blockIndex = 0;
		return marked.use({ renderer: { code({ text, lang }) {
			const highlighted = highlight(text);
			const langLabel = lang ? `<span class="code-lang">${lang}</span>` : "";
			const id = `code-block-${blockIndex++}`;
			return `<pre class="sh-code" id="${id}">${langLabel}<code>${highlighted}</code><button class="copy-btn copy-btn-code" data-copy-target="${id}" aria-label="Copy code">Copy</button></pre>`;
		} } }).parse(readme, { async: false });
	} catch {
		return null;
	}
}
function PackagePage() {
	const { pkg, dependents, versions } = Route.useLoaderData();
	const readmeRef = useRef(null);
	const readmeHtml = useMemo(() => {
		if (!pkg.readme) return null;
		return buildReadmeHtml(pkg.readme);
	}, [pkg.readme]);
	useEffect(() => {
		const el = readmeRef.current;
		if (!el) return;
		const handler = (e) => {
			const btn = e.target.closest(".copy-btn-code");
			if (!btn) return;
			const targetId = btn.dataset.copyTarget;
			if (!targetId) return;
			const pre = document.getElementById(targetId);
			if (!pre) return;
			const code = pre.querySelector("code");
			if (!code) return;
			navigator.clipboard.writeText(code.textContent ?? "").then(() => {
				btn.textContent = "Copied";
				btn.classList.add("copy-btn-done");
				setTimeout(() => {
					btn.textContent = "Copy";
					btn.classList.remove("copy-btn-done");
				}, 2e3);
			});
		};
		el.addEventListener("click", handler);
		return () => el.removeEventListener("click", handler);
	}, [readmeHtml]);
	const runtimeDepCount = pkg.dependencies.runtime.length;
	const peerDepCount = pkg.dependencies.peer.length;
	const devDepCount = pkg.dependencies.dev.length;
	const optionalDepCount = pkg.dependencies.optional.length;
	const totalDeps = runtimeDepCount + peerDepCount + devDepCount + optionalDepCount;
	return /* @__PURE__ */ jsxs("main", {
		className: "pkg-page",
		children: [
			/* @__PURE__ */ jsxs("section", {
				className: "pkg-identity",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "pkg-name-row",
						children: [
							/* @__PURE__ */ jsx("h1", {
								className: "pkg-title",
								children: pkg.name
							}),
							/* @__PURE__ */ jsx(VersionSelector, {
								currentVersion: pkg.version,
								versions,
								packageName: pkg.name
							}),
							pkg.license && /* @__PURE__ */ jsx(Badge, {
								variant: "license",
								children: pkg.license
							})
						]
					}),
					pkg.description && /* @__PURE__ */ jsx("p", {
						className: "pkg-desc-line",
						children: pkg.description
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "pkg-meta-row",
						children: [
							pkg.author && /* @__PURE__ */ jsx("span", {
								className: "meta-item",
								children: cleanAuthor(pkg.author)
							}),
							pkg.repository && /* @__PURE__ */ jsx("a", {
								href: repoHref(pkg.repository),
								target: "_blank",
								rel: "noopener noreferrer",
								className: "meta-item meta-item-link",
								children: repoDisplayUrl(pkg.repository)
							}),
							pkg.homepage && /* @__PURE__ */ jsx("a", {
								href: pkg.homepage,
								target: "_blank",
								rel: "noopener noreferrer",
								className: "meta-item meta-item-link",
								children: pkg.homepage.replace(/^https?:\/\//, "").replace(/\/$/, "")
							}),
							/* @__PURE__ */ jsxs("span", {
								className: "meta-item",
								children: [pkg.fileCount, " files"]
							}),
							/* @__PURE__ */ jsx("span", {
								className: "meta-item",
								children: formatBytes(pkg.totalSize)
							})
						]
					}),
					/* @__PURE__ */ jsx(InstallCommand, {
						name: pkg.name,
						version: pkg.version
					}),
					(pkg.categories.length > 0 || pkg.keywords.length > 0) && /* @__PURE__ */ jsxs("div", {
						className: "pkg-tags-row",
						children: [pkg.categories.map((cat) => /* @__PURE__ */ jsx(Link, {
							to: "/category/$slug",
							params: { slug: cat.category_slug },
							className: `badge badge-${cat.type}`,
							children: cat.category_name
						}, cat.category_slug)), pkg.keywords.map((kw) => /* @__PURE__ */ jsx(Badge, {
							variant: "keyword",
							children: kw
						}, kw))]
					})
				]
			}),
			readmeHtml && /* @__PURE__ */ jsx("section", {
				className: "pkg-readme",
				ref: readmeRef,
				children: /* @__PURE__ */ jsx("div", {
					className: "readme-body",
					dangerouslySetInnerHTML: { __html: readmeHtml }
				})
			}),
			pkg.readme && !readmeHtml && /* @__PURE__ */ jsx("section", {
				className: "pkg-readme",
				children: /* @__PURE__ */ jsx("pre", {
					className: "readme-body readme-raw",
					children: pkg.readme
				})
			}),
			(totalDeps > 0 || dependents.count > 0) && /* @__PURE__ */ jsxs("section", {
				className: "pkg-graph",
				children: [
					/* @__PURE__ */ jsx("h2", {
						className: "pkg-graph-title",
						children: "Dependency Graph"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "pkg-graph-summary",
						children: [
							runtimeDepCount > 0 && /* @__PURE__ */ jsxs("span", {
								className: "graph-stat",
								children: [runtimeDepCount, " deps"]
							}),
							peerDepCount > 0 && /* @__PURE__ */ jsxs("span", {
								className: "graph-stat",
								children: [peerDepCount, " peer"]
							}),
							devDepCount > 0 && /* @__PURE__ */ jsxs("span", {
								className: "graph-stat",
								children: [devDepCount, " dev"]
							}),
							optionalDepCount > 0 && /* @__PURE__ */ jsxs("span", {
								className: "graph-stat",
								children: [optionalDepCount, " optional"]
							}),
							dependents.count > 0 && /* @__PURE__ */ jsxs("span", {
								className: "graph-stat graph-stat-accent",
								children: [dependents.count, " dependents"]
							})
						]
					}),
					/* @__PURE__ */ jsx(DepsSection, {
						title: "Dependencies",
						deps: pkg.dependencies.runtime,
						defaultOpen: true
					}),
					/* @__PURE__ */ jsx(DepsSection, {
						title: "Peer Dependencies",
						deps: pkg.dependencies.peer,
						defaultOpen: true
					}),
					/* @__PURE__ */ jsx(DepsSection, {
						title: "Dev Dependencies",
						deps: pkg.dependencies.dev,
						defaultOpen: devDepCount <= 10
					}),
					/* @__PURE__ */ jsx(DepsSection, {
						title: "Optional Dependencies",
						deps: pkg.dependencies.optional,
						defaultOpen: optionalDepCount <= 10
					}),
					/* @__PURE__ */ jsx(CollapsibleDependents, { dependents })
				]
			})
		]
	});
}
//#endregion
export { PackagePage as component };
