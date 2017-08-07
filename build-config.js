/*eslint strict: ["error", "global"], no-implicit-globals: "off"*/ 'use strict'; /* globals module, */ // license: MPL-2.0
module.exports = function({ /*options, packageJson,*/ manifestJson, files, }) {

	manifestJson.permissions.push(
		'notifications',
		'webNavigation',
		'<all_urls>',
	);

	files.node_modules = {
		es6lib: [
			'functional.js',
			'observer.js',
		],
		'web-ext-utils': {
			lib: [
				'pbq/require.js',
			],
			browser: [
				'index.js',
				'version.js',
			],
			loader: [
				'_background.html',
				'_background.js',
				'_view.js',
				'content.js',
				'index.js',
				'views.js',
			],
			options: {
				'.': [ 'index.js', ],
				editor: [
					'about.js',
					'about.css',
					'index.js',
					'index.css',
					'inline.css',
					'inline.js',
				],
			},
			update: [
				'index.js',
			],
			utils: [
				'event.js',
				'files.js',
				'index.js',
				'semver.js',
			],
		},
	};
};
