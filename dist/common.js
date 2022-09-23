// code common to the background worker and to svelte

import polyfillBrowser from './polyfillBrowser.js';

export function isExtensionUrl(url) {
    if (! url) {
        return false;
    }
    const extensionUrl = polyfillBrowser.runtime.getURL('');
    const urlObject = new URL(url)
    const extensionUrlObject = new URL(extensionUrl)
    return urlObject.hostname == extensionUrlObject.hostname;
}

export function getTabUrl(tab) {
    if (! tab) {
        return null;
    }
    if (tab.pendingUrl) {
        return tab.pendingUrl;
    }
    return tab.url;
}

export async function getTabById(tabId) {
    let tab = await polyfillBrowser.tabs.get(tabId);
    return tab;
}