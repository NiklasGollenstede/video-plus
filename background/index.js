(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { browserAction, Tabs, manifest, },
	'node_modules/web-ext-utils/browser/messages': messages,
	'node_modules/web-ext-utils/loader/': { ContentScript, unloadFrame, },
	'node_modules/web-ext-utils/utils/notify': notify,
	'common/options': options,
	require,
}) => {

let debug; options.debug.whenChange(([ value, ]) => { debug = value; require('node_modules/web-ext-utils/loader/').debug = debug >= 2; });
messages.addHandlers('notify.', Object.assign({ }, notify));

const content = new ContentScript({
	runAt: 'document_end', // it acts delayed anyway
	modules: [ 'content/index', ],
});

options.include.whenChange(values => {
	try { content.include = values; } catch (error) { notify.error(`Invalid URL pattern`, error); throw error; }
});
options.include.children.incognito.whenChange(([ value, ]) => {
	content.incognito = value;
});

browserAction.onClicked.addListener(onClick);
async function onClick() { try {

	const tab = (await Tabs.query({ currentWindow: true, active: true, }))[0];
	if ((await content.appliedToFrame(tab.id, 0))) {
		unloadFrame(tab.id, 0);
	} else {
		onShow(...(await content.applyToFrame(tab.id, 0)));
	}

} catch (error) { notify.error(error); } }

browserAction.setBadgeBackgroundColor({ color: [ 0x00, 0x7f, 0x00, 0x60, ], });

content.onMatch.addListener(onShow); function onShow(frame, url, done) {
	done.catch(notify.error);
	!frame.frameId && browserAction.setBadgeText({ tabId: frame.tabId, text: '✓', });
	!frame.frameId && browserAction.setTitle({ tabId: frame.tabId, title: 'Disable '+ manifest.name, });
}
content.onUnload.addListener(onHide); function onHide(frame) {
	!frame.frameId && browserAction.setBadgeText({ tabId: frame.tabId, text: '', }).catch(_=>_); // can't catch in chrome
	!frame.frameId && browserAction.setTitle({ tabId: frame.tabId, title: 'Enable '+ manifest.name, }).catch(_=>_); // can't catch in chrome
}

(await content.applyNow());

Object.assign(global, { // for debugging
	options, onClick, content, notify,
	Browser: require('node_modules/web-ext-utils/browser/'),
	Loader:  require('node_modules/web-ext-utils/loader/'),
	Utils:   require('node_modules/web-ext-utils/utils/'),
});

}); })(this);
