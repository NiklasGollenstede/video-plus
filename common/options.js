(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/options/': Options,
}) => {

return new Options({ model: {
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
		restrict: {
			match: {
				exp: (/^[\/\^]|^(?:(\*|http|https|file|ftp|app):\/\/(\*|(?:\*\.)?[^\/\*]+|)\/(.*))$/i),
				message: `Each pattern must be of the form <scheme>://<host>/<path> or start with '^' or '/'`,
			},
			unique: '.',
		},
		input: { type: 'string', default: 'https://*.youtube.com/*', },
	},
	css: {
		title: `Style Fixes`,
		maxLength: Infinity,
		default: [
			[ 'vimeo.com', `.player_container { width: 100% !important; }`, ],
			[ 'www.youtube.com', `.watch-stage-mode #player-api { width: 100%; left: 0; margin-left: 0; }`, ],
		],
		restrict: [
			{ match: { exp: (/^[\w-]+(?:\.[\w-]+)+$/), message: `this must be a valid host name`, }, },
			{ },
		],
		input: [
			{ type: 'string', prefix: 'Host:', default: 'www.example.com', style: { display: 'block', marginBottom: '3px', }, },
			{ type: 'text',   prefix: 'CSS: ', default: '.player_container { width: 100% !important; }', },
		],
	},
}, });

}); })(this);
