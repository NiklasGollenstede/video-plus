(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/observer': { RemoveObserver, },
	'node_modules/web-ext-utils/loader/content': { onUnload, },
	'common/options': options,
	'./zoom': { getPadding, calcZoom, },
	module, require,
}) => { /* globals window, document, location, setTimeout, clearTimeout, MutationObserver, */
/* eslint-disable no-console */

/**
 * This file queries and applies the zoom of all videos at appropriate times.
 */

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

let debug; options.debug.whenChange(([ value, ]) => (debug = value));
let transitionDuration; options.transitionDuration.whenChange(([ value, ]) => (transitionDuration = value));

const styleFix = document.createElement('style');
options.css.onAnyChange(updateCss); updateCss(); function updateCss() {
	const values = options.css.values.current;
	const at = values.findIndex(([ host, ]) => host === location.host);
	styleFix.textContent
	= (at < 0 ? options.css.children.default.value : values[at][1])
	+ (options.css.children.background.value ? videoBG : '');
}
onUnload.addListener(() => styleFix.remove());

const defaultStyle = {
	transformOrigin: '50% 50%',
	transitionDuration: transitionDuration / 1000 +'s',
	transitionProperty: 'transform, transform-origin',
	transitionTimingFunction: 'cubic-bezier(1.0, 0.0, 0.7, 0.7)',
};

const windowEvents = [ 'click', 'resize', 'wheel', 'webkitfullscreenchange', 'mozfullscreenchange', 'fullscreenchange', ];
const playerEvents = [ 'playing', 'loadeddata', 'seeked', ];

const videos = new Map/*<HTMLVirdeoElement,VideoResizer?>*/;
onUnload.addListener(() => videos.forEach(_=>_&&_.destroy()));

class VideoResizer {
	constructor(player) {
		this.player = player;

		// use an extra <style> element to style the video because the rules set there are less likely to be overwritten by the page (and should still apply with !important)
		const sheet = this.sheet = player.appendChild(document.createElement('style'));
		this.videoToolsId = player.dataset.videoToolsId = Math.random().toString(32).slice(2);
		sheet.textContent = `video[data-video-tools-id="${this.videoToolsId}"] { }`;

		const style = this.style = /*player.style; //*/ sheet.sheet.cssRules[0].style;
		Object.keys(defaultStyle).forEach(key => style.setProperty(key.replace(/[A-Z]/g, c => '-'+ c.toLowerCase()), defaultStyle[key], 'important'));

		this.size = { width: player.clientWidth, height: player.clientHeight, }; // available video area, updated by the resizeListener
		this.zoom = null; // { x: 0, y: 0, z: 0, }; // current zoom settings (from last call to `.updateZoom()`)
		this.wait = 300; // last wait time between lopped `.updateZoom()` calls
		this.timeout = -1; // setTimeout handle for the next automatic `.updateZoom()` call
		this.updated = 0; // timestamp of the last transitioned zoom update (or zero)
		this.edges = { top: null, right: null, bottom: null, left: null, }; // `edges` parameter to `getPadding`
		this.updateSize = throttle(this.updateSize.bind(this), 500);

		playerEvents.forEach(type => player.addEventListener(type, this));
		windowEvents.forEach(type => window.addEventListener(type, this));
		RemoveObserver.on(player, this.destroy = this.destroy.bind(this));
		videos.set(player, this);

		debug && console.log('new VideoResizer', this);
		if (this.playing) { this.handleEvent({ type: 'playing', }); }
	}

	get playing() { const { player, } = this; return player && !player.paused && !player.ended && player.readyState > 2; }

	handleEvent({ type, }) {
		switch (type) {
			case 'playing': {
				this.updateSize(true);
				this.startPolling();
			} break;
			case 'loadeddata': {
				debug && console.log('discarding edges', this);
				this.edges = { top: null, right: null, bottom: null, left: null, };
			} break;
			case 'seeked': {
				this.zoom = null;
			} break;
			default: { // windowEvents
				this.updateSize(false);
			}
		}
	}

	startPolling() {
		if (this.timeout !== -1) { debug && console.log('ignoring duplicate loop start', this); return; }
		debug && console.log('start loop', this);
		const loop = () => {
			if (!this.playing) { debug && console.log('stop loop', this); this.timeout = -1; return; }
			// const start = performance.now();
			try { this.updateZoom(true); } catch (error) { console.error(error); this.timeout = -1; return; }
			// console.log('updateZoom took', performance.now() - start);
			debug && console.log('loop wait', this.wait);
			this.timeout = setTimeout(loop, this.wait);
		}; this.timeout = setTimeout(loop, this.wait = 300);
	}

	updateSize(force) { // bound & throttled
		const { player, size, } = this;
		const { clientWidth, clientHeight, } = player;
		if (!force && size.width === clientWidth && size.height === clientHeight) { return false; }
		size.width = clientWidth; size.height = clientHeight;
		debug && console.log('resized', this);
		try { this.updateZoom(false); return true; }
		catch (error) { console.error(error); return false; }
	}

	updateZoom(smooth) {
		const { size, player, edges, } = this;

		const padding = getPadding(player, edges);
		const pos = calcZoom(padding, size);
		if (!pos) { debug && console.log('bad padding, retry', padding); this.wait = 300; return; }

		if (!this.zoom) { smooth = false; this.zoom = { x: 0, y: 0, z: 0, }; }

		const change = !smooth ? 1 : [ 'x', 'y', 'z', ].reduce((change, dir) => {
			return change + Math.abs(this.zoom[dir] - (this.zoom[dir] = pos[dir]));
		}, 0);
		this.wait = change > 0.01 ? 300 : Math.min(Math.max(300, this.wait * (1.5 - 50 * change)), 2500);

		const last = (Date.now() - this.updated); if (change > 0 && (
			change > 0.005 // only update on significant changes
			|| (last > 5000 && last > transitionDuration) // or if the transition had enough to change the size.
		)) { //  Otherwise lots of tiny changes after a larger change will keep restarting the transition, which is very slow in the beginning.
			this.setZoom(pos, smooth);
			debug && console.log('cropVideo', change, last > transitionDuration, padding, size, pos, this.wait);
		}
	}

	setZoom({ x, y, z, }, smooth) {
		smooth && (this.updated = Date.now());
		this.style.setProperty('transform', `
			translateX(${ x.toFixed(6) * 100 }%)
			translateY(${ y.toFixed(6) * 100 }%)
			scale(${ z.toFixed(6) })
		`,	'important');
		this.style.setProperty('transition-duration',
			(smooth ? transitionDuration / 1000 : 0) +'s',
		'important');
	}

	destroy() { // bound
		const { player, sheet, } = this; if (!player) { return; }

		sheet && sheet.remove();
		(player.dataset.videoToolsId === this.videoToolsId) && delete player.dataset.videoToolsId;
		clearTimeout(this.timeout);

		playerEvents.forEach(type => player.removeEventListener(type, this));
		windowEvents.forEach(type => window.removeEventListener(type, this));
		RemoveObserver.off(player, this.destroy);
		videos.delete(player);

		debug && console.log('VideoResizer#destroy()', this);
	}
}


// handle every <video> that ever pops up
const insertObserver = new MutationObserver(() => !willCheck && (willCheck = setTimeout(() => {
	willCheck = 0; addAll(); // this should be faster than actually parsing the mutation event
}, 300))); let willCheck = 0;

module.exports = {
	VideoResizer,
	videos,
	insertObserver,
};

debug && Object.assign(global, module.exports); // useful in chrome, but rather pointless in firefox because the context can't be selected
debug >= 2 && typeof exportFunction === 'function' && exportFunction(eval, window, { defineAs: '$vp', }); /* globals exportFunction, */ // but this works in firefox

// there is no need to run early. This should also avoid situations where `document` or its children don't exist yet
if (document.readyState !== 'interactive' && document.readyState !== 'complete') {
	(await new Promise(loaded => document.addEventListener('DOMContentLoaded', loaded)));
}

document.head.appendChild(styleFix);

insertObserver.observe(document.body, { subtree: true, childList: true, });
onUnload.addListener(() => insertObserver.disconnect());

addAll(); function addAll() {
	const players = document.getElementsByTagName('video');
	for (let i = 0, l = players.length; i < l; ++i) {
		const player = players[i]; if (videos.has(player)) { continue; }
		let video = null; try {
			video = new VideoResizer(player);
		} catch (error) { require.async('node_modules/web-ext-utils/browser/messages').then(_=>_.post('notify.error', 'Video not monitored', error)); }
		videos.set(player, video); // don't try again if it fails
	}
}


function throttle(callback, time) {
	let pending = false, last = 0; return function() {
		if (pending) { return; } pending = true;
		const wait = last + time - Date.now();
		setTimeout(() => {
			last = Date.now(); pending = false; callback();
		}, wait > 0 ? wait : 0); // mustn't be << 0 in chrome 53+
	};
}

}); })(this);
