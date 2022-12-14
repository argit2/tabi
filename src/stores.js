import _ from 'lodash';
import { get, writable, readable } from 'svelte/store';
import { ExtensionStorage  } from './storage';

const extensionStorage = new ExtensionStorage();

export let tabLists = writable([]);
export let bookmarkLists = writable({});
export let currentTab = writable({});
export let storage = writable({});
export let importantTabs = writable({});
// deprecated, importantTabs now contain both important and toRead
export let toReadTabs = writable({});
export let expectingTabClose = writable({});

export function updateTabLists(newTabLists) {
    tabLists.update(oldTabLists => newTabLists)
    updateRelevantTabs();
}

export function updateBookmarkLists(newBookmarkLists) {
    bookmarkLists.update(oldBookmarkLists => newBookmarkLists)
}

function getAllTabs() {
    const allTabs = get(tabLists)[0]?.tabs ?? [];
    return allTabs;
}

export function updateRelevantTabs() {
    const allTabs = getAllTabs();
    const isImportantArr = allTabs.map(tab => {
        return getUrlData(tab.url)?.relevant ?? false;
    })
    const importantTabsArr = allTabs.filter((tab, index) => {
        return isImportantArr[index];
    }) ?? [];
    const notImportantTabsArr = allTabs.filter((tab, index) => {
        return ! isImportantArr[index];
    }) ?? [];
    const toReadTabs = notImportantTabsArr.filter((tab) => {
        return getUrlData(tab.url)?.read == 1;
    }) ?? [];
    const tabs = [...importantTabsArr, ...toReadTabs];

    const newImportantTabs = {
        title : 'Important',
        tabs : tabs,
    };
    importantTabs.update(oldImportantTabs => newImportantTabs)
}

export function updateToReadTabs() {
    // deprecated, importantTabs now contain both important and toRead
    const allTabs = getAllTabs();
    const tabs = allTabs.filter(tab => {
        return getUrlData(tab.url)?.read == 1;
    }) ?? [];
    const newToReadTabs = {
        title : 'To Read',
        tabs : tabs,
    };
    toReadTabs.update(oldToReadTabs => newToReadTabs)

}

export function getUrlData(url) {
    url = processUrlToPutOnStorage(url);
    return get(storage)?.urlData[url]
}

export function updateCurrentTab(newCurrentTab) {
    currentTab.update(oldCurrentTab => newCurrentTab);
}

// get chrome storage and put it on svelte store
export async function updateExtensionStorage() {
    const newStorage = await extensionStorage.get();
    storage.update(oldStorage => newStorage);
    const fontSize = getFontSize();
    setFontSizeOnDocument(fontSize);
}

export function processUrlToPutOnStorage (url) {
    if (! url) {
        return url;
    }
    return url.split('#')[0];
}

export async function updateStorage(data) {
    storage.update(oldStorage => _.merge({}, oldStorage, data));
    await extensionStorage.set(data);
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
    await updateStorage(data);
}

export async function setDarkMode(bool) {
    const data = {
        extensionOptions : {
            darkMode : bool
        }
    }
    await updateStorage(data);
}

export function getFontSize () {
    return get(storage)?.extensionOptions?.fontSize ?? getComputedStyle(document.documentElement)?.fontSize ?? '16px';
}

export function setFontSizeOnDocument(value) {
    document.documentElement.style.setProperty('font-size', value);
}

export async function setFontSize(value) {
    const data = {
        extensionOptions: {
            fontSize : value
        }
    }
    await updateStorage(data);
    setFontSizeOnDocument(value);
}

export function updateExpectingTabClose(tabId, value=undefined) {
    expectingTabClose.update(oldDict => {
        if (! oldDict) {
            return oldDict
        }
       oldDict[tabId] = value;
       return oldDict
    })
}