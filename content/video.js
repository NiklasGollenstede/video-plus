(function(global) { 'use strict'; define([ './zoom', ], ({ getPadding, calcZoom, }) => { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
/* eslint-disable no-console */ /* globals window, */

const defaultStyle = {
	'transform-origin': '50% 50%',
	'transition-duration': '0ms',
	'transition-property': 'transform, transform-origin',
	'transition-timing-function': 'cubic-bezier(1.0, 0.0, 0.7, 0.7)', // starts very slow
};

const windowEvents = [ 'click', 'resize', 'wheel', 'webkitfullscreenchange', 'mozfullscreenchange', 'fullscreenchange', 'visibilitychange', ];
const playerEvents = [ 'playing', 'loadeddata', 'seeked', ];

/**
 * Manages the zoom factor of a `<video>` element by applying `calcZoom(getPadding(.player))` as deemed appropriate.
 * The `VideoResizer` automatically works on its `.player` from its construction until it gets `.destroy()`ed.
 * @property  {HTMLVideoElement}  player              The `<video>` element to monitor and zoom. A `<style>` element will be appended as its child. Immutable.
 * @property  {number}            transitionDuration  Duration of the CSS transition used to smoothen changes in the zoom factor, in ms. Mutable.
 * All other methods and properties are for internal use and debugging only.
 */
class VideoResizer {
	/**
	 * @param  {HTMLVideoElement}     player               Permanent value for `this.player`.
	 * @param  {number}               .transitionDuration  Initial value for `this.transitionDuration`.
	 * @param  {CSSStyleDeclaration}  .style               Style node to apply the transformations to.
	 */
	constructor(player, { transitionDuration = 5000, style = player.style, } = { }) {
		this.player = player; this.transitionDuration = transitionDuration; this.style = style;

		// initial state
		this.size = { width: player.clientWidth, height: player.clientHeight, }; // available video area, updated by the resizeListener
		this.zoom = null; // { x: 0, y: 0, z: 0, }; // current zoom settings (from last call to `.updateZoom()`)
		this.wait = 300; // last wait time between lopped `.updateZoom()` calls
		this.timeout = -1; // setTimeout handle for the next automatic `.updateZoom()` call
		this.updated = 0; // timestamp of the last transitioned zoom update (or zero)
		this.edges = { top: null, right: null, bottom: null, left: null, }; // `edges` parameter to `getPadding`

		this.updateSize = throttle(this.updateSize.bind(this), 500);
		playerEvents.forEach(type => player.addEventListener(type, this));
		windowEvents.forEach(type => window.addEventListener(type, this));
		Object.keys(defaultStyle).forEach(key => style.setProperty(key, defaultStyle[key], 'important'));

		debug && console.log('new VideoResizer', this);
		if (this.playing) { this.handleEvent({ type: 'playing', }); }
	}

	// `true` iff the video is currently playing, i.e. the zoom factor should be continuously updated
	get playing() { const { player, } = this; return player && !player.paused && !player.ended && player.readyState > 2; }

	// EventHandler interface method. `event.target` will be either `.player` or `window`.
	handleEvent({ type, }) {
		switch (type) {
			case 'visibilitychange': if (!this.playing || document.visibilityState !== 'visible') { break; } // falls through
			case 'playing': {
				try { this.updateZoom(false); } catch (error) { console.error(error); }
				this.startPolling();
			} break;
			case 'loadeddata': {
				debug && console.log('discarding edges', this);
				this.edges = { top: null, right: null, bottom: null, left: null, };
			} break;
			case 'seeked': {
				try { this.updateZoom(false); } catch (error) { console.error(error); }
			} break;
			default: { // windowEvents
				this.updateSize();
			}
		}
	}

	// may be called only while the video is playing
	startPolling() {
		if (this.timeout !== -1) { debug && console.log('ignoring duplicate loop start', this); return; }
		debug && console.log('start loop', this);
		const loop = () => {
			if (!this.playing || document.visibilityState !== 'visible') { debug && console.log('stop loop', this); this.timeout = -1; return; }
			// const start = performance.now();
			try { this.updateZoom(true); } catch (error) { console.error(error); this.timeout = -1; return; }
			// console.log('updateZoom took', performance.now() - start);
			debug && console.log('loop wait', this.wait);
			this.timeout = setTimeout(loop, this.wait);
		}; this.timeout = setTimeout(loop, this.wait = 300);
	}

	updateSize() { // bound & throttled (thus w/o args or return value)
		const { player, size, } = this;
		const { clientWidth, clientHeight, } = player;
		if (size.width === clientWidth && size.height === clientHeight) { return; }
		size.width = clientWidth; size.height = clientHeight;
		debug && console.log('resized', this);
		try { this.updateZoom(false); } catch (error) { console.error(error); }
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
		this.wait = isNaN(change) // TODO: find out how this can be NaN (hidden video?)
		|| change > 0.01 ? 300 : Math.min(Math.max(300, this.wait * (1.5 - 50 * change)), 2500);

		const last = (Date.now() - this.updated); if (change > 0 && (
			change > 0.005 // only update on significant changes
			|| (last > 5000 && last > this.transitionDuration) // or if the transition had enough to change the size.
		)) { //  Otherwise lots of tiny changes after a larger change will keep restarting the transition, which is very slow in the beginning.
			this.setZoom(pos, smooth);
			debug && console.log('cropVideo', change, last > this.transitionDuration, padding, size, pos, this.wait);
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
			(smooth ? this.transitionDuration : 0) +'ms',
		'important');
	}

	destroy() {
		const { player, } = this; if (!player) { return; }

		playerEvents.forEach(type => player.removeEventListener(type, this));
		windowEvents.forEach(type => window.removeEventListener(type, this));
		clearTimeout(this.timeout);

		this.player = this.transitionDuration = this.style = null;
		this.size = this.zoom = this.edges = null;
		this.wait = this.timeout = this.updated = 0;

		debug && console.log('VideoResizer#destroy()', this);
	}

	static set debug(value) { debug = !!value; }
} let debug = false;

return VideoResizer;

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
