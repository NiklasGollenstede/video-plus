(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Storage, },
	'node_modules/web-ext-utils/options/': Options,
}) => {

const model = {
	include: {
		title: 'Included Sites',
		description: String.raw`<pre>
A list of sites on which this extension should work by default, without clicking it's icon.
Specify as <a href="https://developer.mozilla.org/Add-ons/WebExtensions/Match_patterns">Match Patterns</a> or Regular Expressions (advanced).
Examples:</pre><ul>
<li><code>https://*.youtube.com/*</code>: Matches all YouTube pages</li>
<li><code>https://www.whatever.web/sites.html</code>: Matches exactly that site</li>
<li><code>^https?://(?:www\.)?google\.(?:com|co\.uk|de|fr|com\.au)/.*</code>: Starting with <code>^</code>, this is a Regular Expression. Only use it if you understand it.</li>
<li><code>/.</code>: Starting with <code>/</code>, this is a Regular Expressions too. This one matches everything, so really only use it if you understand what you are doing!</li>
</ul>`,
		maxLength: Infinity,
		default: [ 'https://*.youtube.com/*', ],
		addDefault: 'https://*.youtube.com/*',
		restrict: {
			match: {
				exp: (/^[\/\^]|^(?:(\*|http|https|file|ftp|app):\/\/(\*|(?:\*\.)?[^\/\*]+|)\/(.*))$/i),
				message: `Each pattern must be of the form <scheme>://<host>/<path> or start with '^' or '/'`,
			},
			unique: '.',
		},
		type: 'string',
	},

};

const listerners = new WeakMap;

const options = (await new Options({
	model,
	prefix: 'options',
	storage: Storage.sync,
	addChangeListener(listener) {
		const onChanged = changes => Object.keys(changes).forEach(key => key.startsWith('options') && listener(key, changes[key].newValue));
		listerners.set(listener, onChanged);
		Storage.onChanged.addListener(onChanged);
	},
	removeChangeListener(listener) {
		const onChanged = listerners.get(listener);
		listerners.delete(listener);
		Storage.onChanged.removeListener(onChanged);
	},
}));

options.model = Object.freeze(model);

return options;

}); })(this);
