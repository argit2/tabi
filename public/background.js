// @ts-check
/*
the background worker
- registers callbacks that update the svelte store during tab creation, removal, update
- contains the data structures that will be reused throughout the entire browser section to avoid overhead when opening the app

ideally, the communication with svelte would be by calling a function
however, if we compile the background with svelte, then manifest.json won't be
able to to find background.js
and if we don't compile the background with svelte, it won't be able to update the stores inside svelte
for that reason, we pass a message through chrome api
*/
// import {updateTabLists} from '../stores.js';

import polyfillBrowser from './polyfillBrowser.js';

import {getTabById, getTabUrl, isExtensionUrl} from './common.js';

async function getAllSidebarWindows() {
    const allWindows = await polyfillBrowser.windows.getAll({
        windowTypes : ['popup']
    }) ?? [];
    console.log(allWindows);
    const isSidebarExtensionWindow = await Promise.all(allWindows.map(async w => {
        const tabs = await polyfillBrowser.tabs.query({
            windowId: w.id
        }) ?? [];
        return tabs.some(tab => isExtensionUrl(tab.url));
    }));
    const sidebarWindows = allWindows.filter((w, index) => {
        return isSidebarExtensionWindow[index];
    })
    console.log(sidebarWindows);
    return sidebarWindows;
}

async function closeAllExtensionWindows() {
    const extensionWindows = await getAllSidebarWindows() ?? [];
    extensionWindows.forEach(async extensionWindow => {
        await polyfillBrowser.windows.remove(extensionWindow?.id);
    })
}

function setIconClickForSidebarWindow() {
    polyfillBrowser?.action?.onClicked.addListener(async (tab) => {
        const extensionWindows = await getAllSidebarWindows() ?? [];
        if (extensionWindows.length > 0) {
            await exitSideBarWindowExtensionMode();
        }
        else {
            await startSidebarWindowExtensionMode();
        }
    });
}

function setIconClick() {
    polyfillBrowser?.action?.onClicked.addListener(async (tab) => {
        openExtensionInNewTab();
    });
}

function getExtensionUrl() {
    return polyfillBrowser.runtime.getURL('index.html') ?? '';
}

async function createFullPopUpExtensionWindow() {
    const currentWindow = await polyfillBrowser.windows.getCurrent();
    await polyfillBrowser.windows.create({
        height : currentWindow.height,
        width : currentWindow.width,
        url : getExtensionUrl(),
        type : "popup"
    })
}

async function openExtensionInNewTab() {
    await polyfillBrowser.tabs.create({
        active: true,
        url: getExtensionUrl()
    })
}

const sidebarWidth = 420;
async function startSidebarWindowExtensionMode() {
    const currentWindow = await polyfillBrowser.windows.getCurrent();

    await closeAllExtensionWindows();

    await polyfillBrowser.windows.create({
        height : currentWindow.height,
        width : sidebarWidth,
        left: 0,
        url : getExtensionUrl(),
        type : "popup"
    })
    console.log(currentWindow);
    await polyfillBrowser.windows.update(
        currentWindow.id,
        {
            state: "normal",
            left: sidebarWidth,
            width: currentWindow.width - sidebarWidth,

        }
    )
}

async function exitSideBarWindowExtensionMode() {
    const currentWindow = await polyfillBrowser.windows.getCurrent();

    await closeAllExtensionWindows();

    await polyfillBrowser.windows.update(
        currentWindow.id,
        {
            left: currentWindow.left - sidebarWidth,
            width: currentWindow.width + sidebarWidth,

        }
    )
}

class TabBackgroundWorker {
    constructor () {
        this.initializeEventListeners();
        this.setReplyToSvelte();
        this.activeTabId = null;
    }

    async replyToSvelte(request, sender, sendResponse) {
        sendResponse = sendResponse == null ? () => null : sendResponse;
        switch (request?.messageType) {
            case 'getTabs':
                sendResponse({
                })
                break;
            // we use the background script just for initialize that value
            // we need to know this before we open new tab with the extension
            case 'getLastAccessedNonExtensionTab':
                sendResponse({
                    tabId : this.activeTabId,
                })
                break;
            default:
                console.log('Unknown messageType', request);
                break;
        }
    }

    async setReplyToSvelte() {
        const backgroundWorker = this;
        polyfillBrowser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            backgroundWorker.replyToSvelte(request, sender, sendResponse);
            return true; // enables sendResponse asynchronous
        });
    }
    
    async sendDataToSvelte() {
        // placeholder just to check if it's being passed
        let interval = setInterval(async () => {
            try {
                const message = {}
                console.log('sending message');
                polyfillBrowser.runtime.sendMessage(message, {}, function(response) {
                    if (response) {
                        clearInterval(interval);
                    }
                });
            }
            catch (e) {
                console.log(e);
            }
        }, 1000);
    }

    async onTabActivated(activeInfo) {
        if (! activeInfo) {
            return;
        }
        const tab = await getTabById(activeInfo.tabId);
        await this.setActiveTabId(tab);
    }

    async setActiveTabId(tab) {
        if (! tab) {
            return;
        }
        const tabUrl = getTabUrl(tab);
        // about:blank condition is because
        // when opening new tab on firefox, tabUrl is about:blank even if it's
        // an extension tab
        if (isExtensionUrl(tabUrl) || tabUrl.includes('about:blank')) {
            return;
        }
        this.activeTabId = tab.id;
    }

    initializeEventListeners() {
        polyfillBrowser.tabs.onActivated.addListener(
            (activeInfo) => this.onTabActivated(activeInfo)
        )
    }
}

setIconClick();
const backgroundWorker = new TabBackgroundWorker();