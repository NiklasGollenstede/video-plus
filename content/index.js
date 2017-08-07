(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/observer': { InsertObserver, RemoveObserver, },
	'node_modules/es6lib/functional': { throttle, },
	'node_modules/web-ext-utils/loader/content': { onUnload, },
	'common/options': options,
	'./zoom': { getPadding, calcZoom, },
}) => { /* globals window, document, location, setTimeout, clearTimeout, */
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
; }`;

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

const insertObserver = new InsertObserver(document);
onUnload.addListener(() => insertObserver.removeAll());
insertObserver.on('video', video => new Video(video));

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
		const sheet = this.sheet = player.appendChild(document.createElement('style')); sheet.scoped = true;
		sheet.textContent = (sheet.hasAttribute('scoped') ? 'video:scope' : (
			'video[data-video-tools-id="'+ (player.dataset.videoToolsId = Math.random().toString(32).slice(2)) +'"]'
		)) +' { }';
		const style = this.style = /*player.style; //*/ sheet.sheet.cssRules[0].style;
		Object.keys(defaultStyle).forEach(key => style.setProperty(key.replace(/[A-Z]/g, c => '-'+ c.toLowerCase()), defaultStyle[key], 'important'));

		this.size = { width: player.clientWidth, height: player.clientHeight, };
		this.zoom = { x: 0, y: 0, z: 0, };
		this.lastCheck = 0;
		this.timeout = -1;

		player.addEventListener('playing', this);
		player.addEventListener('loadeddata', this);

		!videos.size && resizeListener.attach();
		videos.add(this);
		RemoveObserver.on(player, this.destroy = this.destroy.bind(this));

		this.edges = { top: null, right: null, bottom: null, left: null, };
		if (player.readyState >= 2) {
			this.updateZoom(false);
			!player.paused && this.checkPadding();
		}
	}

	handleEvent(event) {
		switch (event.type) {
			case 'playing': {
				this.checkPadding(false);
			} break;
			case 'loadeddata': {
				this.edges = { top: null, right: null, bottom: null, left: null, };
			} break;
		}
	}

	checkPadding(recursive) {
		// const start = performance.now();
		if (this.player.paused) { debug && console.log('checkPadding stop loop', this); this.timeout = -1; return; }
		if (!recursive && this.timeout !== -1) { debug && console.log('checkPadding ignoring duplicate start', this); return; }
		debug && !recursive && console.log('checkPadding start loop', this);
		const wait = this.updateZoom(recursive);
		debug && console.log('checkPadding loop wait', wait, recursive);
		clearTimeout(this.timeout);
		this.timeout = setTimeout(() => this.checkPadding(true), recursive ? wait : 300);
		this.lastCheck = Date.now();
		// console.log('checkPadding took', performance.now() - start);
	}

	updateZoom(smooth) {
		const { size, player, edges, } = this;

		const padding = getPadding(player, edges);
		const pos = calcZoom(padding, size);
		if (!pos) { debug && console.log('bad padding, retry', padding); return 300; }

		const change = !smooth ? 1 : [ 'x', 'y', 'z', ].reduce((change, dir) => {
			return change + Math.abs(this.zoom[dir] - (this.zoom[dir] = pos[dir]));
		}, 0);
		const last = (Date.now() - this.lastCheck);
		const wait = change > 0.01 ? 300 : Math.min(Math.max(300, last * (1.5 - 50 * change)), 2500);

		if (change > 0.005 || (last > 5000 && last > transitionDuration)) {
			this.setZoom(pos, smooth);
			debug && console.log('cropVideo', change, last > transitionDuration, padding, size, pos, wait);
		}

		return wait;
	}

	setZoom({ x, y, z, }, smooth) {
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
		!sheet.hasAttribute('scoped') && delete player.dataset.videoToolsId;
		sheet.remove();
		clearTimeout(this.timeout);

		videos.delete(this);
		!videos.size && resizeListener.detach();
		RemoveObserver.off(player, this.destroy);
	}
}

const resizeListener = {
	events: [ 'click', 'resize', 'wheel', 'webkitfullscreenchange', 'mozfullscreenchange', 'fullscreenchange', ],
	attach() { this.events.forEach(type => window.addEventListener(type, this)); console.log('resizeListener attach'); },
	detach() { this.events.forEach(type => window.removeEventListener(type, this)); console.log('resizeListener detach'); },
	handleEvent: throttle(() => videos.forEach(video => {
		const { player, size, } = video;
		const { clientWidth, clientHeight, } = player;
		if (size.width === clientWidth && size.height === clientHeight) { return; }
		size.width = clientWidth; size.height = clientHeight;
		debug && console.log('resized', video);
		video.updateZoom(false);
	}), 200),
};

return {
	videos,
	resizeListener,
};

}); })(this);
