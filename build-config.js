/*eslint strict: ["error", "global"], no-implicit-globals: "off"*/ 'use strict'; /* globals module, */ // license: MPL-2.0
module.exports = function({ options, /*packageJson,*/ manifestJson, files, }) {

	manifestJson.permissions.push(
		'notifications',
		'webNavigation',
		'tabs',
		'<all_urls>',
	);

	manifestJson.browser_action = {
		default_icon: manifestJson.icons,
		default_title: `Toggle ${ manifestJson.name }`,
	};

	!options.viewRoot && (options.viewRoot = options.chrome ? 'VideoPlus.html' : 'VideoPlus');

	files.node_modules = [
		'es6lib/functional.js',
		'es6lib/observer.js',
		'pbq/require.js',
		'web-ext-utils/browser/index.js',
		'web-ext-utils/browser/storage.js',
		'web-ext-utils/browser/version.js',
		'web-ext-utils/loader/_background.html',
		'web-ext-utils/loader/_background.js',
		'web-ext-utils/loader/_view.html',
		'web-ext-utils/loader/_view.js',
		'web-ext-utils/loader/content.js',
		'web-ext-utils/loader/index.js',
		'web-ext-utils/loader/views.js',
		'web-ext-utils/options/editor/about.css',
		'web-ext-utils/options/editor/about.js',
		'web-ext-utils/options/editor/index.css',
		'web-ext-utils/options/editor/index.js',
		'web-ext-utils/options/editor/inline.js',
		'web-ext-utils/options/editor/inline.css',
		'web-ext-utils/options/index.js',
		'web-ext-utils/utils/event.js',
		'web-ext-utils/utils/files.js',
		'web-ext-utils/utils/index.js',
		'web-ext-utils/utils/notify.js',
		'web-ext-utils/utils/icons/',
	];

};
