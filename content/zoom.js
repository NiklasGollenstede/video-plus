(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	exports,
}) => {

// test urls:
// Varying height:   https://www.youtube.com/watch?v=sAsAVUqnvrY
// YouTube embedded: https://www.youtube.com/embed/mHWr4WY9o24
// Very wide:        https://www.youtube.com/watch?v=GAvr5_EtOnI
// Ultra wide:       https://www.youtube.com/watch?v=BFR8VIwgPSY
// changing edges:   https://www.youtube.com/watch?v=dN-r4B6oezc=140
// changing edges:   https://www.youtube.com/watch?v=3kDpXyuucGE
// white edges:      https://www.youtube.com/watch?v=u_KK8KFqwkE
// Vimeo:            https://vimeo.com/194906601
// 1px frame:        https://vimeo.com/194906601
// ...

const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
const probes = [ 0.25, 0.5, 0.75, ]; // positions along each side at which to probe the padding
const offset = 2; // pixel offset around the video to ignore
const depth = 3 / 8; // relative maximum padding on each side
const tol = 8; // the +- tolerance within which each RGB channel hast to stay to be considered margin
function getPadding(video, edges) {
	// const start = performance.now();
	const width = canvas.width = video.videoWidth; // even a single videos dimensions can change
	const height = canvas.height = video.videoHeight;

	const padding = { width, height, top: 0, left: 0, bottom: 0, right: 0, };
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
		) { padding[sideName] = 0; return; }

		cR = cR / length << 0; cG = cG / length << 0; cB = cB / length << 0; cA = cA / length << 0;
		const cuR = cR + tol, cuG = cG + tol, cuB = cB + tol, cuA = cA + tol; // upper and lower bound for the color of the pixels of the probes from this edge
		const clR = cR - tol, clG = cG - tol, clB = cB - tol, clA = cA - tol;
		void cuA; void clA; // TODO: either use the alpha channel or don't compute these

		// get the depth up to which the colors stay within the tolerance around the average color
		side.padding = Math.min(...probes.map(probe => {
			const pixels = side.probe(probe);
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
			const colorsPerPx = 4 * Math.min(pixels.width, pixels.height); // for some reason .with or .height is sometimes !== 1
			// console.log('probe', sideName, probe, padding);
			return Math.abs(i - start) / colorsPerPx;
		}));

		if (side.padding > side.depth - 2) { padding[sideName] = NaN; return; } // to much padding ==> failure
		if (side.padding <              2) { padding[sideName] =   0; return; } // not enough padding, but that is OK

		if (edges) { // check that the edge color stayed the same as last time
			const read = [ cR, cG, cB, cA, ];
			let last = edges[sideName]; if (!last) { last = edges[sideName] = read.slice(); }
			// const _log = last.slice();
			let change = 0; for (let i = 0; i < 4; ++i) {
				if (read[i] === last[i]) { continue; }
				change = Math.abs(read[i] - last[i]);
				last[i] = approach(last[i], read[i], tol); // update a bit
			}
			// change && console.info(`color changed from ${ _log } to ${ read } by ${ change } ==> (${ last })`);
			if (change > 2) { padding[sideName] = NaN; return; } // color changed too much ==> failure
		}

		padding[sideName] = side.padding; return; // all good
	});

	// console.log('getPadding took', performance.now() - start);
	return padding;
}

/**
 * @param  {object}   video      True video outer dimensions and padding in px: { width, height, top, left, bottom, right, }.
 * @param  {object}   container  Dimensions of the container.
 * @return {object?}             Relative translateX/Y and scale as { x, y, z, }.
 */
function calcZoom(video, container) {

	// in data px
	const dataW = video.width  - video.left - video.right;
	const dataH = video.height - video.top  - video.bottom;
	if (isNaN(dataW) || isNaN(dataH)) { return null; }

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

function approach(from, to, by) {
	return from > to ? Math.max(to, from - by) : Math.min(to, from + by);
}

return {
	getPadding,
	calcZoom,
};

}); })(this);
