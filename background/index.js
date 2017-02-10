(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { browserAction, Tabs, },
	// 'node_modules/web-ext-utils/browser/version': { gecko, },
	'node_modules/web-ext-utils/loader/': { ContentScript, },
	'node_modules/web-ext-utils/update/': updated,
	'node_modules/web-ext-utils/utils/': { reportError, },
	'common/options': options,
}) => {

updated.extension.to.channel !== '' && console.info('Ran updates', updated);

const content = new ContentScript({
	runAt: 'document_end',
	modules: [ 'content/index', ],
});

options.children.include.whenChange((_, { current, }) => {
	try { content.include = current; } catch (error) { reportError(`Invalid value`, error); throw error; }
});

browserAction && browserAction.onClicked.addListener(onClick);
async function onClick() { try {

	const tab = (await Tabs.query({ currentWindow: true, active: true, }))[0];
	(await content.applyToFrame(tab.id, 0));

} catch (error) { reportError(error); throw error; } }

(await content.applyNow());

Object.assign(global, { onClick, reportError, }); // for debugging

}); })(this);
