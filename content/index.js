(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/observer': { RemoveObserver, },
	'node_modules/es6lib/functional': { throttle, },
	'node_modules/web-ext-utils/loader/content': { onUnload, },
	'common/options': options,
	'./zoom': { getPadding, calcZoom, },
	module,
}) => { /* globals window, document, location, setTimeout, clearTimeout, MutationObserver, */
/* eslint-disable no-console */

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

const styleFix = (document.head || document.documentElement).appendChild(document.createElement('style'));
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

const videos = new Set;
onUnload.addListener(() => videos.forEach(_=>_.destroy()));

class Video {
	constructor(player) {
		this.player = player;

		// use an extra <style> element to style the video because the rules set there are less likely to be overwritten by the page (and should still apply with !important)
		const sheet = this.sheet = player.appendChild(document.createElement('style'));
		this.videoToolsId = player.dataset.videoToolsId = Math.random().toString(32).slice(2);
		sheet.textContent = `video[data-video-tools-id="${this.videoToolsId}"] { }`;

		const style = this.style = /*player.style; //*/ sheet.sheet.cssRules[0].style;
		Object.keys(defaultStyle).forEach(key => style.setProperty(key.replace(/[A-Z]/g, c => '-'+ c.toLowerCase()), defaultStyle[key], 'important'));

		this.size = { width: player.clientWidth, height: player.clientHeight, }; // available video area, updated by the resizeListener
		this.zoom = { x: 0, y: 0, z: 0, }; // current zoom settings (from last call to `.updateZoom()`)
		this.wait = 300; // last wait time between lopped `.updateZoom()` calls
		this.timeout = -1; // setTimeout handle for the next automatic `.updateZoom()` call
		this.updated = 0; // timestamp of the last transitioned zoom update (or zero)

		player.addEventListener('playing', this);
		player.addEventListener('loadeddata', this);

		!videos.size && resizeListener.attach();
		videos.add(this);
		RemoveObserver.on(player, this.destroy = this.destroy.bind(this));

		this.edges = { top: null, right: null, bottom: null, left: null, };
		if (player.readyState >= 2) {
			this.updateZoom(false);
			this.startPolling();
		}
	}

	handleEvent(event) {
		switch (event.type) {
			case 'playing': {
				this.startPolling();
			} break;
			case 'loadeddata': {
				debug && console.log('discarding edges', this);
				this.edges = { top: null, right: null, bottom: null, left: null, };
			} break;
		}
	}

	startPolling() {
		if (this.player.paused) { return; }
		if (this.timeout !== -1) { debug && console.log('ignoring duplicate loop start', this); return; }
		debug && console.log('start loop', this);
		const loop = () => {
			if (this.player.paused) { debug && console.log('stop loop', this); this.timeout = -1; return; }
			// const start = performance.now();
			try { this.updateZoom(true); } catch (error) { console.error(error); this.timeout = -1; return; }
			// console.log('updateZoom took', performance.now() - start);
			debug && console.log('loop wait', this.wait);
			this.timeout = setTimeout(loop, this.wait);
		}; this.timeout = setTimeout(loop, this.wait = 300);
	}

	updateZoom(smooth) {
		const { size, player, edges, } = this;

		const padding = getPadding(player, edges);
		const pos = calcZoom(padding, size);
		if (!pos) { debug && console.log('bad padding, retry', padding); this.wait = 300; return; }

		const change = !smooth ? 1 : [ 'x', 'y', 'z', ].reduce((change, dir) => {
			return change + Math.abs(this.zoom[dir] - (this.zoom[dir] = pos[dir]));
		}, 0);
		this.wait = change > 0.01 ? 300 : Math.min(Math.max(300, this.wait * (1.5 - 50 * change)), 2500);

		const last = (Date.now() - this.updated); if (
			change > 0.005 // only update on significant changes
			|| (last > 5000 && last > transitionDuration) // or if the transition had enough to change the size.
		) { //  Otherwise lots of tiny changes after a larger change will keep restarting the transition, which is very slow in the beginning.
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

	destroy() {
		const { player, sheet, } = this;
		debug && console.log('video.destroy()', this);
		player.removeEventListener('playing', this);
		player.removeEventListener('loadeddata', this);
		(player.dataset.videoToolsId === this.videoToolsId) && delete player.dataset.videoToolsId;
		sheet.remove();
		clearTimeout(this.timeout);

		videos.delete(this);
		!videos.size && resizeListener.detach();
		RemoveObserver.off(player, this.destroy);
	}
}

const resizeListener = {
	events: [ 'click', 'resize', 'wheel', 'webkitfullscreenchange', 'mozfullscreenchange', 'fullscreenchange', ],
	attach() { this.events.forEach(type => window.addEventListener(type, this)); debug && console.log('resizeListener attach'); },
	detach() { this.events.forEach(type => window.removeEventListener(type, this)); debug && console.log('resizeListener detach'); },
	handleEvent: throttle(() => videos.forEach(video => {
		const { player, size, } = video;
		const { clientWidth, clientHeight, } = player;
		if (size.width === clientWidth && size.height === clientHeight) { return; }
		size.width = clientWidth; size.height = clientHeight;
		debug && console.log('resized', video);
		video.updateZoom(false);
	}), 200),
};

// handle every <video> that ever pops up
const insertObserver = new MutationObserver(_=>_.forEach(_=>_.addedNodes.forEach(element => {
	if (element.tagName === 'VIDEO') { new Video(element); }
	else if (element.querySelectorAll) { element.querySelectorAll('video').forEach(video => new Video(video)); }
}))); insertObserver.observe(document.body || document, { subtree: true, childList: true, });
onUnload.addListener(() => insertObserver.disconnect());

module.exports = {
	Video,
	videos,
	resizeListener,
	insertObserver,
};

debug && Object.assign(global, module.exports);
debug >= 2 && typeof exportFunction === 'function' && exportFunction(eval, window, { defineAs: '$vp', }); /* globals exportFunction, */

document.querySelectorAll('video').forEach(video => new Video(video));

}); })(this);
