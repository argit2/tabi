import _ from 'lodash';
import { get, writable, readable } from 'svelte/store';
import { ExtensionStorage  } from './storage';

const extensionStorage = new ExtensionStorage();

export let tabLists = writable([]);
export let currentTab = writable({});
export let storage = writable({});

export function updateTabLists(newTabLists) {
    tabLists.update(oldTabLists => newTabLists)
}

export function updateCurrentTab(newCurrentTab) {
    currentTab.update(oldCurrentTab => newCurrentTab);
}

export async function updateExtensionStorage() {
    const newStorage = await extensionStorage.get();
    storage.update(oldStorage => newStorage);
}

export function processUrlToPutOnStorage (url) {
    if (! url) {
        return url;
    }
    return url.split('?')[0];
}

export async function setTabProperty(url, property, value) {
    url = processUrlToPutOnStorage(url)
    if (! url) {
        return;
    }
    if (property == null) {
        return;
    }
    const data = {urlData : {}};
    data.urlData[url] = {};
    data.urlData[url][property] = value;
    storage.update(oldStorage => _.merge({}, oldStorage, data));
    await extensionStorage.set(data);
}