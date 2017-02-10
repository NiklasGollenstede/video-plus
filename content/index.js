(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/dom': { createElement, },
	'node_modules/es6lib/observer': { CreationObserver, RemoveObserver, },
	'node_modules/es6lib/functional': { throttle, },
	'node_modules/web-ext-utils/loader/content': { onUnload, },
	// 'common/options': optionsRoot,
}) => {

// test urls:
// Varying height:   https://www.youtube.com/watch?v=sAsAVUqnvrY
// YouTube embedded: https://www.youtube.com/embed/mHWr4WY9o24
// Very wide:        https://www.youtube.com/watch?v=GAvr5_EtOnI
// Ultra wide:       https://www.youtube.com/watch?v=BFR8VIwgPSY
// changing edges:   https://www.youtube.com/watch?v=BxcjZdAxI_U&t=140
// changing edges:   https://www.youtube.com/watch?v=3kDpXyuucGE
// Vimeo:            https://vimeo.com/174593392
// ...

const styleFix = (document.head || document.documentElement).appendChild(createElement('style', null, [ {
	'vimeo.com': `
		.player_container { width: 100% !important; }
	`,
	'www.youtube.com': `
		.watch-stage-mode #player-api { width: 100%; left: 0; margin-left: 0; }
	`,
}[location.host], ]));
onUnload.addListener(() => styleFix.remove());

const observer = new CreationObserver(document);
onUnload.addListener(() => observer.removeAll());

const videos = new Map;
onUnload.addListener(() => Array.from(videos.keys()).forEach(videoRemoved));

observer.on('video', videoAdded);

function videoAdded(video) {
	const px = 1 / window.devicePixelRatio;
	!videos.size && attachSizeListeners();
	const styleElement = video.appendChild(createElement('style', { scoped: true, }));
	styleElement.textContent = (`video`+ (
		styleElement.hasAttribute('scoped') ? ':scope'
		: ('[data-video-tools-id="'+ (video.dataset.videoToolsId = Math.random().toString(36).slice(2)) +'"]')
	) +` {
			width: 100% !important;
			left: auto !important;
			transform-origin: 50% 50% !important;
			transition-duration: 5s !important;
			transition-timing-function: cubic-bezier(1.0, 0.0, 0.7, 0.7) !important;
			background-color: #000;
			background-image:
				repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.05) ${ 0*px }px, rgba(255, 255, 255, 0.05) ${ 2*px }px, transparent ${ 2*px }px, transparent ${ 4*px }px),
				repeating-linear-gradient(+45deg, rgba(255, 255, 255, 0.05) ${ 0*px }px, rgba(255, 255, 255, 0.05) ${ 2*px }px, transparent ${ 2*px }px, transparent ${ 4*px }px)
			;
		}
	`);
	videos.set(video, {
		styleElement, style: styleElement.sheet.cssRules[0].style,
		size: { width: video.clientWidth, height: video.clientHeight, },
		latsPos: { x: 0, y: 0, z: 0, },
		lastCheck: 0,
		timeout: -1,
	});
	initPadding({ target: video, });
	attachPaddingListeners(video);
	RemoveObserver.on(video, videoRemoved);
}

function videoRemoved(video) {
	console.log('videoRemoved', video);
	delete video.dataset.videoToolsId;
	const info = videos.get(video);
	info.styleElement.remove();
	clearTimeout(info.timeout);
	videos.delete(video);
	!videos.size && detachSizeListeners();
	detachPaddingListeners(video);
	RemoveObserver.off(video, videoRemoved);
}

const events = [ 'click', 'resize', 'wheel', ];
function attachSizeListeners() {
	events.forEach(type => window.addEventListener(type, checkSize));
}
function detachSizeListeners() {
	events.forEach(type => window.removeEventListener(type, checkSize));
}

const checkSize = throttle(() => {
	videos.forEach(({ size, }, video) => {
		const { clientWidth, clientHeight, } = video;
		if (size.width === clientWidth && size.height === clientHeight) { return; }
		size.width = clientWidth; size.height = clientHeight;
		cropVideo(video, false); // even if paused
	});
}, 200);

function attachPaddingListeners(video) {
	video.addEventListener('playing', checkPadding);
	video.addEventListener('loadeddata', initPadding);
}
function detachPaddingListeners(video) {
	video.removeEventListener('playing', checkPadding);
	video.removeEventListener('loadeddata', initPadding);
}

function initPadding({ target: video, }) {
	const edge = [ 0, 0, 0, 255, ];
	videos.get(video).edges = {
		top: edge.slice(),
		right: edge.slice(),
		bottom: edge.slice(),
		left: edge.slice(),
	};
	video.playing && checkPadding(...arguments);
}
function checkPadding({ target: video, type, }) {
	if (video.paused) { return; }
	const info = videos.get(video);
	const wait = cropVideo(video, true);
	clearTimeout(info.timeout);
	info.timeout = setTimeout(checkPadding, type ? 300 : wait, ({ target: video, }));
	info.lastCheck = Date.now();
}

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
function getPadding(video) {
	const probes = [ 0.25, 0.5, 0.75, ];
	const depth = 3 / 8;
	const tol = 8, tol2 = 2 * tol;
	const width = canvas.width = video.videoWidth;
	const height = canvas.height = video.videoHeight;

	const padding = { width, height, top: 0, left: 0, bottom: 0, right: 0, };
	const { edges, } = videos.get(video);
	ctx.drawImage(
		video,
		0, 0, width, height,
		0, 0, width, height
	);

	const sides = { //                      (                  x,                    y,         width,         height)
		top:    {
			edge:  ()    => ctx.getImageData(                  0,                    2,         width,              1),
			probe: probe => ctx.getImageData(      width * probe,                    0,             1, height * depth),
			reverse: false, depth: height * depth << 0,
		},
		left:   {
			edge:  ()    => ctx.getImageData(                  2,                    0,             1,         height),
			probe: probe => ctx.getImageData(                  0,       height * probe, width * depth,              1),
			reverse: false, depth: width * depth << 0,
		},
		bottom: {
			edge:  ()    => ctx.getImageData(                  0,           height - 3,         width,              1),
			probe: probe => ctx.getImageData(      width * probe, height * (1 - depth),             1, height * depth),
			reverse: true, depth: height * depth << 0,
		},
		right:  {
			edge:  ()    => ctx.getImageData(          width - 3,                    0,             1,         height),
			probe: probe => ctx.getImageData(width * (1 - depth),       height * probe, width * depth,              1),
			reverse: true, depth: width * depth << 0,
		},
	};

	Object.keys(sides).forEach(sideName => {
		const side = sides[sideName];

		// get the average color along the edge of the current side
		const edge = side.edge().data, length = edge.length / 4;
		let   cR = 0, cG = 0, cB = 0, cA = 0; // (will be) average color along the edge
		let   tR = 0, tG = 0, tB = 0, tA = 0; // temp
		let   cRl = edge[0], cRu = cRl;       // (will be) upper and lower bound for the color along the edge
		let   cGl = edge[1], cGu = cGl;
		let   cBl = edge[2], cBu = cBl;
		let   cAl = edge[3], cAu = cAl;
		for (let i = 0, l = edge.length; i < l; i += 4) {
			tR = edge[i + 0]; tG = edge[i + 1]; tB = edge[i + 2]; tA = edge[i + 3];
			cR += tR; cG += tG; cB += tB; cA += tA;
			cRl > tR ? (cRl = tR) : cRu < tR ? (cRu = tR) : 0;
			cGl > tG ? (cGl = tG) : cGu < tG ? (cGu = tG) : 0;
			cBl > tB ? (cBl = tB) : cBu < tB ? (cBu = tB) : 0;
			cAl > tA ? (cAl = tA) : cAu < tA ? (cAu = tA) : 0;
		}
		if ( // color  along the edge not uniform enough
			   cRu - cRl > tol2
			|| cGu - cGl > tol2
			|| cBu - cBl > tol2
			|| cAu - cAl > tol2
		) { return (padding[sideName] = 0); }

		cR = cR / length << 0; cG = cG / length << 0; cB = cB / length << 0; cA = cA / length << 0;
		const cuR = cR + tol, cuG = cG + tol, cuB = cB + tol, cuA = cA + tol; // upper and lower bound for the color of the pixels of the probes from this edge
		const clR = cR - tol, clG = cG - tol, clB = cB - tol, clA = cA - tol;

		// get the depth up to which the colors stay within the tolerance around the average color
		let _padding = Math.min(...probes.map(probe => {
			const pixels = side.probe(probe);
			const data = pixels.data;
			let   start, inc, stop, i;
			if (!side.reverse) {
				start = +0; stop = data.length - 0; inc = +4;
			} else {
				start = data.length - 4; stop = -4; inc = -4;
			}
			i = start;
			while (
				i !== stop
				&& cuR >= data[i + 0] && cuG >= data[i + 1] && cuB >= data[i + 2] // && cuA >= data[i + 3]
				&& clR <= data[i + 0] && clG <= data[i + 1] && clB <= data[i + 2] // && clA <= data[i + 3]
			) { i += inc; }
			const colorsPerPx = 4 * Math.min(pixels.width, pixels.height); // for some reason .with or .height is sometimes !== 1
			return Math.abs(i - start) / colorsPerPx;
			// console.log('probe', sideName, probe, padding);
		}));

		if (_padding > side.depth - 5) { return (padding[sideName] = NaN); } // to much padding
		if (_padding <              5) { return (padding[sideName] =   0); } // not enough padding

		{ // check that the edge color stayed the same as last time
			const read = [ cR, cG, cB, cA, ];
			const last = edges[sideName], _log = last.slice();
			let exit; for (let i = 0; i < 4; ++i) {
				if (read[i] === last[i]) { continue; }
				last[i] = approach(last[i], read[i], tol); // update a bit
			}

			isNaN(_padding) && console.log('color changed from '+_log+' to '+read+' ('+last+')');
		}

		return (padding[sideName] = _padding);
	});

	return padding;
}

/**
 * @param  {object}  video      True video outer dimensions and padding in px: { width, height, top, left, bottom, right, }.
 * @param  {object}  container  Dimensions of the container.
 * @return {object}             Relative translateX/Y and scale as { x, y, z, }.
 */
function calcPos(video, container, mode) {

	// in data px
	const dataW = video.width  - video.left - video.right;
	const dataH = video.height - video.top  - video.bottom;
	if (isNaN(dataW + dataH)) { null; }

	// implicit scale factor
	const defDpp  = Math.max(
		video.width  / container.width,
		video.height / container.height
	);
	// in px on display
	const displayW = dataW / defDpp;
	const displayH = dataH / defDpp;

	const scaleX = video.width  / dataW;
	const scaleY = video.height / dataH;

	const z = Math.min(
		Math.max(scaleX, scaleY),
		container.width  / displayW,
		container.height / displayH
	);

	// relative
	const x = - (video.left - video.right) / video.width / 2;
	const y = - (video.top - video.bottom) / video.height / 2;

	// in px
	// const x = - (video.left - video.right) / 2 * defDpp;
	// const y = - (video.top - video.bottom) / 2 * defDpp;

	return { x, y, z, };
}

function cropVideo(video, smooth) {
	const info = videos.get(video);
	const { size, style, } = info;
	const padding = getPadding(video);

	const pos = calcPos(padding, size);

	if (pos == null) { console.log('bad padding, retry', padding); return 300; }

	const change = !smooth ? 1 : [ 'x', 'y', 'z', ].reduce((change, dir) => {
		return change + Math.abs(info.latsPos[dir] - (info.latsPos[dir] = pos[dir]));
	}, 0);
	const last = (Date.now() - info.lastCheck);
	const wait = change > 0.01 ? 300 : Math.min(2500, last * (1.5 - 50 * change));

	if (change > 0.005 || last > 6000) {
		style[(pos.z !== 1 ? 'set' : 'remove') +'Property']('transform', `
			scale(${ pos.z.toFixed(6) })
			translateX(${ pos.x.toFixed(6) * 100 * 0.25 }%)
			translateY(${ pos.y.toFixed(6) * 100 * 0.25 }%)
		`,	'important');
		style.setProperty('transition-property',
			smooth ? 'transform, transform-origin' : 'none',
		'important');

		console.log('cropVideo', padding, size, pos, wait);
	} else {
		console.log('minimal change', wait);
	}

	return wait;
}

function approach(from, to, step) {
	return from > to ? Math.max(to, from - step) : Math.min(to, from + step);
}

}); })(this);
