(function(global) { 'use strict'; define(() => { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

// test urls:
// Varying height:   https://www.youtube.com/watch?v=sAsAVUqnvrY
// YouTube embedded: https://www.youtube.com/embed/mHWr4WY9o24
// Very wide:        https://www.youtube.com/watch?v=GAvr5_EtOnI
// Ultra wide:       https://www.youtube.com/watch?v=BFR8VIwgPSY
// changing edges:   https://www.youtube.com/watch?v=dN-r4B6oezc=140
// changing edges:   https://www.youtube.com/watch?v=3kDpXyuucGE
// changing edges:   https://www.youtube.com/watch?v=e2vBLd5Egnk
// white edges:      https://www.youtube.com/watch?v=u_KK8KFqwkE
// 16:9 on 4:3:      https://www.youtube.com/watch?v=IG7WSnovCAI
// ...

let probes = [ 0.25, 0.5, 0.75, ]; // positions along each side at which to probe the padding
// ; let probes = new Array(16).fill(1).map((_, i, a) => (i + 1) / (a.length + 1));
let offset = 2; // pixel offset around the video to ignore
let depth = 3 / 8; // relative maximum padding on each side
let tol = 8; // the +- tolerance within which each RGB channel hast to stay to be considered margin

const canvas = global.document.createElement('canvas'), ctx = canvas.getContext('2d');

/**
 * @param  {HTMLVideoElement}  video  Video element to read from.
 * @param  {object}            edges  Object holding the previous edge colors. Will be updated with the current colors.
 *                                    May start of as empty object and should be passed to all future readings of the same video track.
 * @return {object}                   `video`s outer dimensions and padding before the detected content starts,
 *                                    as numbers in canvas pixels: { width, height, top, left, bottom, right, }.
 */
function getPadding(video, edges) {
	// const start = performance.now();
	const width = canvas.width = video.videoWidth; // s videos dimensions can change during playback
	const height = canvas.height = video.videoHeight;
	const padding = { width, height, top: NaN, left: NaN, bottom: NaN, right: NaN, };
	if (!width || !height) { return padding; }

	ctx.drawImage(
		video,
		0, 0, width, height,
		0, 0, width, height
	);

	const sides = { //                      (                           x,                              y,               width,                height)
		top:    {
			edge:  ()    => ctx.getImageData(                      offset,                         offset,  width - 2 * offset,                    1),
			probe: probe => ctx.getImageData(               width * probe,                         offset,                   1,       height * depth),
			reverse: false, padding: 0,
			depth: height * depth << 0,
		},
		left:   {
			edge:  ()    => ctx.getImageData(                      offset,                         offset,                   1,  height - 2 * offset),
			probe: probe => ctx.getImageData(                      offset,                 height * probe,       width * depth,                    1),
			reverse: false, padding: 0,
			depth:  width * depth << 0,
		},
		bottom: {
			edge:  ()    => ctx.getImageData(                      offset,            height - offset - 1,  width - 2 * offset,                    1),
			probe: probe => ctx.getImageData(               width * probe,  height * (1 - depth) - offset,                   1,       height * depth),
			reverse:  true, padding: 0,
			depth: height * depth << 0,
		},
		right:  {
			edge:  ()    => ctx.getImageData(          width - offset - 1,                         offset,                   1,  height - 2 * offset),
			probe: probe => ctx.getImageData(width * (1 - depth) - offset,                 height * probe,       width * depth,                    1),
			reverse:  true, padding: 0,
			depth:  width * depth << 0,
		},
	};

	for (let i = 0; i < 4; ++i) { const sideName = sideNames[i], side = sides[sideName]; {

		// get the average, upper and lower color along the edge of the current side
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
			cRl > tR ? (cRl = tR) : cRu < tR ? (cRu = tR) : void 0;
			cGl > tG ? (cGl = tG) : cGu < tG ? (cGu = tG) : void 0;
			cBl > tB ? (cBl = tB) : cBu < tB ? (cBu = tB) : void 0;
			cAl > tA ? (cAl = tA) : cAu < tA ? (cAu = tA) : void 0;
		}
		if ( // color along the edge not uniform enough, so there is no padding at all
			   cRu - cRl > tol << 1
			|| cGu - cGl > tol << 1
			|| cBu - cBl > tol << 1
			|| cAu - cAl > tol << 1
		) { padding[sideName] = 0; continue; }

		cR = cR / length << 0; cG = cG / length << 0; cB = cB / length << 0; cA = cA / length << 0;
		const cuR = cR + tol, cuG = cG + tol, cuB = cB + tol, cuA = cA + tol; // upper and lower bound for the color of the pixels of the probes from this edge
		const clR = cR - tol, clG = cG - tol, clB = cB - tol, clA = cA - tol;
		void cuA; void clA; // TODO: either use the alpha channel or don't compute these

		// get the depth up to which the colors stay within the tolerance around the average color
		let pad = 2 ** 30; for (let j = 0, l = probes.length; j < l; ++j) {
			const pixels = side.probe(probes[j]);
			const data = pixels.data;
			let   start, inc, stop, i;
			if (!side.reverse) {
				start = +0; stop  = data.length - 0; inc = +4;
			} else {
				stop  = -4; start = data.length - 4; inc = -4;
			}
			i = start;
			while (
				i !== stop
				&& cuR >= data[i + 0] && cuG >= data[i + 1] && cuB >= data[i + 2] // && cuA >= data[i + 3]
				&& clR <= data[i + 0] && clG <= data[i + 1] && clB <= data[i + 2] // && clA <= data[i + 3]
			) { i += inc; }
			const colorsPerPx = 4 * min(pixels.width, pixels.height); // for some reason .with or .height is sometimes !== 1
			// console.log('probe', sideName, probe, padding);
			pad = min(pad, abs(i - start) / colorsPerPx);
		}

		if (pad > side.depth - 2) { padding[sideName] = NaN; continue; } // to much padding ==> failure
		if (pad <              2) { padding[sideName] =   0; continue; } // not enough padding, but that is OK

		if (edges) { // check that the edge color stayed the same as last time
			const read = [ cR, cG, cB, cA, ];
			let last = edges[sideName]; if (!last) { last = edges[sideName] = read.slice(); }
			// const _log = last.slice();
			let change = 0; for (let i = 0; i < 4; ++i) {
				if (read[i] === last[i]) { continue; }
				change = abs(read[i] - last[i]);
				last[i] = approach(last[i], read[i], tol); // update a bit
			}
			// change && console.info(`color changed from ${ _log } to ${ read } by ${ change } ==> (${ last })`);
			if (change > 2) { padding[sideName] = NaN; continue; } // color changed too much ==> failure
		}

		padding[sideName] = pad; continue; // all good
	} }

	// console.log('getPadding took', performance.now() - start);
	return padding;
}

/**
 * Given a videos dimension, padding and display area, computes { x, y, z, } such that:
 * If the video is first shifted by x/y parts and then scaled (up) by the factor z,
 * it is scaled exactly as large as possible and moved just as much as necessary
 * to have it cover the maximum of the available area without stretching or cropping anything that is not padding.
 * @param  {object}   video      True video outer dimensions and padding in canvas pixels: { width, height, top, left, bottom, right, }.
 * @param  {object}   container  Dimensions { width, height, } of the container in CSS px.
 * @return {object?}             Relative translateX/Y and scale as { x, y, z, } or `null` if any of the dimensions in `video` are NaN.
 */
function calcZoom(video, container) {

	// The actual width and height of the video in canvas pixels ...
	const dataW = video.width  - video.left - video.right;
	const dataH = video.height - video.top  - video.bottom;
	if (isNaN(dataW) || isNaN(dataH)) { return null; }

	// ... and the implicit scale factor automatically applied by the browser ...
	const implScale  = min( /* TODO this assumes `object-fit: contain` */
		container.width  / video.width,
		container.height / video.height,
	);
	// ... multiplied, results in this actual width and height of the video in CSS px.
	const displayW = dataW * implScale;
	const displayH = dataH * implScale;

	// To remove the padding (within the video area), the video would need to be stretched by these factors.
	const scaleX = video.width  / dataW;
	const scaleY = video.height / dataH;

	// But we don't want to stretch, we want to scale both dimensions evenly.
	const z = min(max(scaleX, scaleY), min( // So we use the maximum,
		container.width  / displayW || 1, // but cap it so that no actual data is cropped off left/right
		container.height / displayH || 1, // or at the top/bottom (of the container).
	));

	// Scaling the video by z would now let is cover as much of the available area as possible,
	// except that, for videos with different paddings on opposing edges, it will be cropped of on one side.

	// For the dimension with the lower stretch factor that is easily fixed.
	// All the space is needed, so simply center the actual content in the available area:
	// We calculate how much more the video needs to be pushed to the right/bottom (relatively),
	// divide that by 2 and multiply it by the scale factor.
	const x = (video.right - video.left) / video.width  / 2 * z;
	const y = (video.bottom - video.top) / video.height / 2 * z;
	const zoom = { x, y, z, };

	// But while just centering the video along the dimension with (potentially) additional free space works,
	// it can move the video around without actually increasing the view area.
	// So we only want to move the video as far as actually necessary to display all of it
	// and otherwise leave it at its normal position.
	{
		const horizontal = (container.width - displayW * z > container.height - displayH * z); // more free room left along the horizontal (or vertical) axis (<dimension>)
		const start = horizontal ?         (video.left < video.right) :         (video.top < video.bottom); // whether to move away from the start (or end) within the dimension (<end>)
		const vPad =  horizontal ? (start ? video.left : video.right) : (start ? video.top : video.bottom); // padding at the <end> of <dimension>
		const vDim = horizontal ? video.width : video.height, cDim = horizontal ? container.width : container.height; // video/container size along the <dimension>
		const gain = (z - 1) * (vDim / 2 - vPad); // pixels gained at the <end> of <dimension> by scaling
		const room = (cDim / implScale - vDim) / 2 + vPad; // room at the <end> of <dimension> that can be discarded without loosing information
		const cropped = gain - room; // content that would be cropped off without moving
		const shift = cropped <= 0 ? 0 : (start ? +1 : -1) * cropped / vDim; // necessary move to avoid cropping
		if (horizontal) { zoom.x = shift; } else { zoom.y = shift; }
	}

	return zoom; // see function description

	// NOTE: While the comments imply `object-fit: contain`, this should also work for `cover` and others.
}

function setOptions(options) {
	if ('probes' in options) { probes = options.probes; }
	if ('offset' in options) { offset = options.offset; }
	if ('depth' in options) { depth = options.depth; }
	if ('tol' in options) { tol = options.tol; }
}

function approach(from, to, by) {
	return from > to ? max(to, from - by) : min(to, from + by);
}

// these may or may not be faster than the native functions (which are overloaded)
function abs(i) { i=+i; return i < 0 ? -i : i; }
function min(i, j) { i=+i; j=+j; return i < j ? i : j; }
function max(i, j) { i=+i; j=+j; return i > j ? i : j; }
const sideNames = [ 'top', 'left', 'bottom', 'right', ]; // and this avoids calling `Object.keys(sides)`

return {
	setOptions,
	getPadding,
	calcZoom,
};

}); })(this);
