(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/options/': Options,
	'node_modules/web-ext-utils/browser/version': { gecko, },
	'node_modules/web-ext-utils/browser/storage': { sync: storage, },
}) => {

const isBeta = manifest.applications.gecko.id.endsWith('-dev');

const model = {
	include: {
		title: 'Included Sites',
		description: String.raw`
			A list of sites on which this extension should work by default, without clicking it's icon.<br>
			Specify as <a href="https://developer.mozilla.org/Add-ons/WebExtensions/Match_patterns">Match Patterns</a>
			or <a href="https://regex101.com/">Regular Expressions</a> (advanced, must start with <code>^</code> and end with <code>$</code>).<br>
			<details><summary>[Examples]:</summary><ul>
				<li><code>https://*.youtube.com/*</code>: Matches all YouTube pages</li>
				<li><code>https://www.whatever.web/sites.html</code>: Matches exactly that site</li>
				<li><code>&lt;all_urls&gt;</code>: Matches every URL</li>
				<li><code>^https?://(?:www\.)?google\.(?:com|co\.uk|de|fr|com\.au)/.*$</code>: Starting with <code>^</code> and ending with <code>$</code>, this is a Regular Expression.</li>
				<li><code>^.*$</code>: This is a Regular Expressions too. This one matches everything, so really only use it if you understand what you are doing!</li>
			</ul></details>
		`,
		maxLength: Infinity,
		default: [ 'https://*.youtube.com/*', 'https://*.vimeo.com/*', ],
		restrict: { unique: '.', match: {
			exp: (/^(?:\^.*\$|<all_urls>|(?:(\*|http|https|file|ftp|app):\/\/(\*|(?:\*\.)?[^/* ]+|)\/([^ ]*)))$/i),
			message: `Each pattern must be of the form <scheme>://<host>/<path> or be framed with '^' and '$'`,
		}, },
		input: { type: 'string', default: 'https://*.youtube.com/*', },
		children: {
			incognito: {
				default: !gecko, hidden: !gecko, // this is only relevant in Firefox, Chrome has a separate check box for this
				input: { type: 'boolean', suffix: `include Private Browsing windows`, },
			},
		},
	},
	css: {
		title: 'Style Fixes',
		description: `The video content can only be enlarged if there is space available in the video element. Therefore, it is necessary to increase the <code>&lt;video&gt;</code> elements size, esp. its <code>width</code> to occupy all available space.<br>
		For better visualization, the <i>mesh background</i> can be enabled. If there is no dark gray mash pattern visible next to the video, the video won't be able to expand into that area.`,
		maxLength: Infinity,
		default: [
			[ 'www.youtube.com', [
				`.watch-stage-mode #player-api {\n\twidth: 100% !important;\n\tleft: 0 !important;\n\tmargin-left: 0 !important;\n}`,
				`.html5-video-container {\n\theight: 100% !important;\n}`,
				`video.html5-main-video {\n\twidth: 100% !important;\n\theight: 100% !important;\n\ttop: 0 !important;\n\tleft: 0 !important;\n}`,
			].join('\n'), ],
			[ 'gaming.youtube.com', [
				`/* This only works properly in "Theater mode" */`,
				`.html5-video-player {\n\toverflow: visible !important;\n}`,
				`.html5-video-container {\n\toverflow: hidden !important;\n\theight: 100% !important;\n\tmargin-left: 50% !important;\n\tleft: -50vw !important;\n\twidth: 100vw !important;\n}`,
				`video.html5-main-video {\n\twidth: 100% !important;\n\theight: 100% !important;\n\ttop: 0 !important;\n\tleft: 0 !important;\n}`,
			].join('\n'), ],
			[ 'vimeo.com', `.player_outro_area,\n.player_container,\n.vp-player-layout {\n\twidth: 100% !important;\n\tleft: 0 !important;\n}`, ],
		],
		restrict: [
			{ match: { exp: (/^[\w-]+(?:\.[\w-]+)+$/), message: `this must be a valid host name (e.g. "example.com")`, }, },
			{ type: 'string', },
		],
		input: [
			{ type: 'string', prefix: 'Host:', default: 'www.example.com', style: { display: 'block', marginBottom: '3px', }, },
			{ type: 'text',   prefix: 'CSS: ', default: `.player_container { width: 100% !important; }`, },
		],
		children: {
			default: {
				title: 'Default',
				description: `Applied to all <i>Included Sites</i> without own <i>Style Fix</i>.`,
				default: '',
				restrict: { type: 'string', },
				input: { type: 'text', prefix: 'CSS: ', },
			},
			background: {
				default: false,
				restrict: { type: 'boolean', },
				input: { type: 'boolean', suffix: 'add <b>mesh background</b> for visualization', },
			},
		},
	},
	transitionDuration: {
		title: 'Resize Delay',
		description: `In some esp. darker videos the detected padding can change over time, sometimes quite rapidly and quite a lot.<br>
		To prevent constant shaking of the video, the resizing is delayed and slowly applied over a couple of seconds.<br>
		Lower values will result in quicker responses to actual changes in padding, but may lead to resizing e.g. even in short dark scenes.`,
		default: 5000,
		restrict: { type: 'number', from: 0, to: 10000, },
		input: { type: 'integer', suffix: 'ms', },
	},
	debug: {
		title: 'Debug Level',
		expanded: false,
		default: 0,
		hidden: !isBeta,
		restrict: { type: 'number', from: 0, to: 2, },
		input: { type: 'integer', suffix: 'set to > 0 to enable debugging', },
	},
};

return (await new Options({ model, storage, prefix: 'options', })).children;

}); })(this);
