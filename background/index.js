(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { browserAction, Tabs, manifest, },
	'node_modules/web-ext-utils/loader/': { ContentScript, detachFormTab, },
	'node_modules/web-ext-utils/update/': updated,
	'node_modules/web-ext-utils/utils/': { reportError, },
	'common/options': options,
	require,
}) => {

let debug; options.debug.whenChange(([ value, ]) => { debug = value; require('node_modules/web-ext-utils/loader/').debug = debug >= 2; });
debug && console.info(manifest.name, 'loaded, updated', updated);

browserAction.setIcon({ path: manifest.icons, }); // fennec 55 nightly doesn't like browserAction icons in the manifest

const content = new ContentScript({
	runAt: 'document_end',
	modules: [ 'content/index', ],
});

options.include.whenChange(values => {
	try { content.include = values; } catch (error) { reportError(`Invalid URL pattern`, error); throw error; }
});

browserAction.onClicked.addListener(onClick);
async function onClick() { try {

	const tab = (await Tabs.query({ currentWindow: true, active: true, }))[0];
	if ((await content.appliedToFrame(tab.id, 0))) {
		detachFormTab(tab.id, 0);
	} else {
		onShow(...(await content.applyToFrame(tab.id, 0)));
	}

} catch (error) { reportError(error); } }

browserAction.setBadgeBackgroundColor({ color: [ 0x00, 0x7f, 0x00, 0x60, ], });

content.onShow.addListener(onShow);
content.onMatch.addListener(onShow);
function onShow(frame, url, done) {
	done.catch(reportError);
	!frame.frameId && browserAction.setBadgeText({ tabId: frame.tabId, text: '✓', });
	!frame.frameId && browserAction.setTitle({ tabId: frame.tabId, title: 'Disable '+ manifest.name, });
}
content.onHide.addListener(onHide);
function onHide(frame) {
	!frame.frameId && browserAction.setBadgeText({ tabId: frame.tabId, text: '', }).catch(_=>_); // can't catch in chrome
	!frame.frameId && browserAction.setTitle({ tabId: frame.tabId, title: 'Enable '+ manifest.name, }).catch(_=>_); // can't catch in chrome
}

(await content.applyNow());

Object.assign(global, { // for debugging
	options, onClick, content,
	Browser: require('node_modules/web-ext-utils/browser/'),
	Loader:  require('node_modules/web-ext-utils/loader/'),
	Utils:   require('node_modules/web-ext-utils/utils/'),
});

}); })(this);
