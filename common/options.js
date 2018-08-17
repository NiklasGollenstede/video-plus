(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/options/': Options,
	'node_modules/web-ext-utils/browser/storage': { sync: storage, },
}) => {

const isBeta = (/^\d+\.\d+.\d+(?!$)/).test((global.browser || global.chrome).runtime.getManifest().version); // version doesn't end after the 3rd number ==> bata channel

const model = {
	include: {
		title: 'Included Sites',
		description: String.raw`
			A list of sites on which this extension should work by default, without clicking it's icon.<br>
			Specify as <a href="https://developer.mozilla.org/Add-ons/WebExtensions/Match_patterns">Match Patterns</a>
			or <a href="https://regex101.com/">Regular Expressions</a> (advanced, must start with <code>^</code> and end with <code>$</code>).<br>
			Examples:<ul>
				<li><code>https://*.youtube.com/*</code>: Matches all YouTube pages</li>
				<li><code>https://www.whatever.web/sites.html</code>: Matches exactly that site</li>
				<li><code>&lt;all_urls&gt;</code>: Matches every URL</li>
				<li><code>^https?://(?:www\.)?google\.(?:com|co\.uk|de|fr|com\.au)/.*$</code>: Starting with <code>^</code> and ending with <code>$</code>, this is a Regular Expression.</li>
				<li><code>^.*$</code>: This is a Regular Expressions too. This one matches everything, so really only use it if you understand what you are doing!</li>
			</ul>
		`,
		maxLength: Infinity,
		default: [ 'https://*.youtube.com/*', 'https://*.vimeo.com/*', ],
		restrict: { unique: '.', match: {
			exp: (/^(?:\^.*\$|<all_urls>|(?:(\*|http|https|file|ftp|app):\/\/(\*|(?:\*\.)?[^/* ]+|)\/([^ ]*)))$/i),
			message: `Each pattern must be of the form <scheme>://<host>/<path> or be framed with '^' and '$'`,
		}, },
		input: { type: 'string', default: 'https://*.youtube.com/*', },
	},
	css: {
		title: 'Style Fixes',
		maxLength: Infinity,
		default: [
			[ 'vimeo.com', `.player_outro_area,\n.player_container,\n.vp-player-layout {\n\twidth: 100% !important;\n\tleft: 0 !important;\n}`, ],
			[ 'www.youtube.com', [
				`.watch-stage-mode #player-api {\n\twidth: 100% !important;\n\tleft: 0 !important;\n\tmargin-left: 0 !important;\n}`,
				`.html5-video-container {\n\theight: 100% !important;\n}`,
				`.html5-main-video {\n\twidth: 100% !important;\n\theight: 100% !important;\n\ttop: 0 !important;\n\tleft: 0 !important;\n}`,
			].join('\n'), ],
		],
		restrict: [
			{ match: { exp: (/^[\w-]+(?:\.[\w-]+)+$/), message: `this must be a valid host name`, }, },
			{ type: 'string', },
		],
		input: [
			{ type: 'string', prefix: 'Host:', default: 'www.example.com', style: { display: 'block', marginBottom: '3px', }, },
			{ type: 'text',   prefix: 'CSS: ', default: `.player_container { width: 100% !important; }`, },
		],
		children: {
			default: {
				title: 'Default',
				default: ``,
				restrict: { type: 'string', },
				input: { type: 'text', prefix: 'CSS: ', },
			},
			background: {
				default: false,
				restrict: { type: 'boolean', },
				input: { type: 'boolean', suffix: 'add mesh background', },
			},
		},
	},
	transitionDuration: {
		title: 'transitionDuration',
		default: 5000,
		restrict: { type: 'number', from: 0, to: 10000, },
		input: { type: 'integer', suffix: 'ms', },
	},
	debug: {
		title: 'Debug Level',
		expanded: false,
		default: +isBeta,
		hidden: !isBeta,
		restrict: { type: 'number', from: 0, to: 2, },
		input: { type: 'integer', suffix: 'set to > 0 to enable debugging', },
	},
};

return (await new Options({ model, storage, prefix: 'options', })).children;

}); })(this);
