/*eslint strict: ["error", "global"], no-implicit-globals: "off"*/ 'use strict'; /* globals module, */ // license: MPL-2.0
module.exports = function({ /*options, packageJson,*/ manifestJson, files, }) {

	manifestJson.permissions.push(
		'notifications',
		'tabs',
		'webNavigation',
		'<all_urls>'
	);

	manifestJson.browser_action = {
		default_icon: manifestJson.icons,
		default_title: 'Apply to the current page',
	};

	files.node_modules = {
		es6lib: [
			'concurrent.js',
			'dom.js',
			'functional.js',
			'index.js',
			'network.js',
			'object.js',
			'observer.js',
			'port.js',
			'require.js',
			'string.js',
		],
		'web-ext-utils': {
			'.': [
				'browser/',
				'loader/',
			],
			options: {
				'.': [ 'index.js', ],
				editor: [
					'about.js',
					'about.css',
					'index.js',
					'index.css',
					'inline.css',
					'inline.html',
					'inline.js',
				],
			},
			update: [
				'index.js',
			],
			utils: [
				'files.js',
				'index.js',
				'inject.js',
				'semver.js',
			],
		},
	};
};
