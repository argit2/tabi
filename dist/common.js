// code common to the background worker and to svelte

import polyfillBrowser from './polyfillBrowser.js';

export function isExtensionUrl(url) {
    if (! url) {
        return false;
    }
    const extensionUrl = polyfillBrowser.runtime.getURL('');
    const urlObject = buildUrl(url);
    const extensionUrlObject = buildUrl(extensionUrl);
    if(urlObject == null || extensionUrlObject == null) {
        return false;
    }
    return urlObject.hostname == extensionUrlObject.hostname;
}

export function buildUrl(url) {
    try {
        const urlObject = new URL(url);
        return urlObject;
    }
    catch(e) {
        return null;
    }
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