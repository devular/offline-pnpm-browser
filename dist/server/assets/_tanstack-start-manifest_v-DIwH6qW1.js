//#region \0tanstack-start-manifest:v
var tsrStartManifest = () => ({
	"routes": {
		"__root__": {
			"filePath": "/Users/jonsherrard/projects/offline-setup/src/routes/__root.tsx",
			"children": [
				"/",
				"/category/$slug",
				"/package/$name"
			],
			"preloads": ["/assets/main-B1iZwqMh.js", "/assets/preload-helper-r4tpkvBZ.js"]
		},
		"/": {
			"filePath": "/Users/jonsherrard/projects/offline-setup/src/routes/index.tsx",
			"preloads": ["/assets/routes-BD4EvzkQ.js"]
		},
		"/category/$slug": {
			"filePath": "/Users/jonsherrard/projects/offline-setup/src/routes/category.$slug.tsx",
			"preloads": ["/assets/category._slug-sOozokC_.js", "/assets/Badge-BETiRZJg.js"]
		},
		"/package/$name": {
			"filePath": "/Users/jonsherrard/projects/offline-setup/src/routes/package.$name.tsx",
			"preloads": ["/assets/package._name-BwXx4NLI.js", "/assets/Badge-BETiRZJg.js"]
		}
	},
	"clientEntry": "/assets/main-B1iZwqMh.js"
});
//#endregion
export { tsrStartManifest };
