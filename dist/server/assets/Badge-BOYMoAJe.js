import { jsx } from "react/jsx-runtime";
//#region src/components/Badge.tsx
function Badge({ variant, children }) {
	return /* @__PURE__ */ jsx("span", {
		className: `badge badge-${variant}`,
		children
	});
}
//#endregion
export { Badge as t };
