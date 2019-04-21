(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/observer': { RemoveObserver, },
	'node_modules/web-ext-utils/loader/content': { onUnload, },
	'common/options': options,
	'./video': VideoResizer,
	module, require,
}) => { /* globals window, document, location, setTimeout, clearTimeout, MutationObserver, */
/* eslint-disable no-console */

/**
 * This file queries and applies the zoom of all videos at appropriate times.
 */

const videos = new Map/*<HTMLVirdeoElement,VideoResizer?>*/;
onUnload.addListener(() => videos.forEach(_=>_&&_._destroy()));

let debug; options.debug.whenChange(([ value, ]) => { debug = VideoResizer.debug = value; });
let transitionDuration; options.transitionDuration.whenChange(([ value, ]) => { transitionDuration = value; videos.forEach(_=>_&&(_.transitionDuration = value)); });

const videoBG = `video { background-image:
	repeating-linear-gradient(-45deg,
		rgba(255, 255, 255, 0.05) 0px, rgba(255, 255, 255, 0.05) 2px,
		transparent 2px, transparent 4px
	),
	repeating-linear-gradient(+45deg,
		rgba(255, 255, 255, 0.05) 0px, rgba(255, 255, 255, 0.05) 2px,
		transparent 2px, transparent 4px
	)
!important; }`;

const styleFix = document.createElement('style'); // this should really be injected as a dynamic content script style from the background, but there is no decent API yet
options.css.onAnyChange(updateCss); updateCss(); function updateCss() {
	const values = options.css.values.current;
	const at = values.findIndex(([ host, ]) => host === location.host);
	styleFix.textContent
	= (options.css.children.background.value ? videoBG : '')
	+ (at < 0 ? options.css.children.default.value : values[at][1]);
}
onUnload.addListener(() => styleFix.remove());

// While nodes are being added or removed from the DOM, run `addAll()` every 300ms.
// This should be faster than actually interpreting the mutation events,
// under the assumptions that there are only a few videos in the page and that is ok to wait a bit before handling them.
const insertObserver = new MutationObserver(() => {
	!willCheck && (willCheck = setTimeout(() => { willCheck = 0; addAll(); }, 300));
}); let willCheck = 0;

module.exports = { // export before things can go wrong ...
	VideoResizer,
	videos,
	insertObserver,
};
debug && Object.assign(global, module.exports); // useful in chrome, but rather pointless in firefox because the context can't be selected
debug >= 2 && typeof exportFunction === 'function' && exportFunction(eval, window, { defineAs: '$vp', }); /* globals exportFunction, */ // but this works in firefox

// There is no need to run early. This should also avoid situations where `document` or its children don't exist yet.
if (document.readyState !== 'interactive' && document.readyState !== 'complete') {
	(await new Promise(loaded => document.addEventListener('DOMContentLoaded', loaded)));
}

document.head.appendChild(styleFix);

insertObserver.observe(document.body, { subtree: true, childList: true, });
onUnload.addListener(() => insertObserver.disconnect());

// Checks if there are any new `<video>`s in the DOM and creates `VideoResizer` instances for them.
addAll(); function addAll() {
	const players = document.getElementsByTagName('video');
	for (let i = 0, l = players.length; i < l; ++i) { const player = players[i]; {
		if (videos.has(player)) { continue; }
		let video = null; try {

			// use an extra <style> element to style the video because the rules set there are less likely to be overwritten by the page (and should still apply with !important)
			const sheet = player.appendChild(document.createElement('style'));
			const videoToolsId = player.dataset.videoToolsId = Math.random().toString(32).slice(2);
			sheet.textContent = `video[data-video-tools-id="${videoToolsId}"] { }`;
			const style = sheet.sheet.cssRules[0].style;

			video = new VideoResizer(player, { transitionDuration, style, });
			RemoveObserver.on(player, video._destroy = () => {
				sheet.remove(); (player.dataset.videoToolsId === videoToolsId) && delete player.dataset.videoToolsId;
				video.destroy(); videos.delete(player);
				RemoveObserver.off(player, video._destroy); delete video._destroy;
			});
		} catch (error) { require.async('node_modules/web-ext-utils/browser/messages').then(_=>_.post('notify.error', 'Video not monitored', error)); }
		videos.set(player, video); // don't try again even if it fails
	} }
}

}); })(this);
