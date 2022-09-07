import polyfillBrowser from './polyfillBrowser.js';
import * as FastDiceCoefficient from './lib/fast-dice-coefficient/dice.js';
const sorensenDice = FastDiceCoefficient.dice;
import {updateTabLists, updateCurrentTab, updateExtensionStorage} from './stores.js';

// warning: slow
function cloneObject(obj) {
    if (! obj) {
        return null;
    }

    return JSON.parse(JSON.stringify(obj));
}

function getDomain(url) {
    if (! url) {
        return url;
    }
    const urlObject = new URL(url);
    const hostname = urlObject.hostname;
    const split = hostname.split('.');
    if (split.length == 1) {
        return split[0];
    }
    // example: kit.svelte.dev should return svelte.dev
    // example2: blog.tumblr.com should return tumblr.com
    return `${split[split.length - 2]}.${split[split.length -1]}`;
}

function isBrowserUrl(url) {
    if (! url) {
        return false;
    }
    const urlObject = new URL(url);
    const usesBrowserProtocol = !! urlObject.protocol?.match(/browser|chrome|firefox|moz|about|vivaldi|brave|opera/gi);
    const isNewTab = !! urlObject.hostname?.match(/newtab/gi);
    return usesBrowserProtocol || isNewTab;
}

function getTabUrl(tab) {
    if (! tab) {
        return null;
    }
    if (tab.url) {
        return tab.url;
    }
    return tab.pendingUrl;
}

function stringToTokens(str) {
    if (! str) {
        return [];
    }
    return str.toLowerCase().match(/[a-zA-Z]+/gi)
}

function arrIsEmpty(arr) {
    return Array.isArray(arr) && arr.length == 0;
}

// this class was initially made on background.js because it would hold
// persistent data structures
// those functions no longer need to be in a class
class BrowserMediator {
    constructor () {
    }

    async initializeCurrentTabs() {
        const tabs = await this.getTabsFromCurrentWindow();

        const history = await polyfillBrowser.history.search({text : ''});
        const visits = await Promise.all(tabs.map(async tab => {
            return polyfillBrowser.history.getVisits({url : getTabUrl(tab)})

        }));
        console.log(history);
        console.log(visits)
    }

    async getCurrentTab() {
        let tab = null;
        if (this.activeTabId != null) {
            tab = await polyfillBrowser.tabs.get(this.activeTabId);
        }
        if (tab == null || arrIsEmpty(tab)) {
            tab = await polyfillBrowser.tabs.query({ active: true, currentWindow : true});
        }
        if (tab == null || arrIsEmpty(tab)) {
            const windowId = await polyfillBrowser.windows.getCurrent()?.id;
            tab = await polyfillBrowser.tabs.query({active : true, windowId : windowId});
        }
        return tab;
    }

    async getTabsFromCurrentWindow() {
        let tabs = await polyfillBrowser.tabs.query({currentWindow : true});
        if (tabs == null || arrIsEmpty(tabs)) {
            const windowId = await polyfillBrowser.windows.getCurrent()?.id;
            tabs = await polyfillBrowser.tabs.query({windowId : windowId});
        }
        if (tabs == null || arrIsEmpty(tabs)) {

        }
        return tabs ?? [];
    }

    async getTabLists() {
        const tabs = await this.getTabsFromCurrentWindow();
        let currentTab = await this.getCurrentTab();
        if (! tabs || ! currentTab || currentTab.length == 0) {
            return [];
        }
        currentTab = currentTab;

        const manualOrderComparison = (a1, a2) => {
            return a1.index - a2.index;
        }

        const domain = getDomain(getTabUrl(currentTab));
        const tabsWithSameDomain = tabs.filter(tab => {
            return domain && getDomain(getTabUrl(tab)) == domain;
        })
        .sort(manualOrderComparison);
        
        // const currentTitleTokens = stringToTokens(currentTab.title);
        const minimumSimilarity = 0.25;
        const tabSimilarity = tabs.map(tab => {
            // const titleTokens = stringToTokens(tab.title);
            const similarity = sorensenDice(currentTab.title ?? '', tab.title ?? '')
            return [tab, similarity];
        })
        .filter(a => a[1] >= minimumSimilarity)
        .sort((a1, a2) => {
            if (a1[1] == a2[1]) {
                return manualOrderComparison(a1, a2);
            }
            return a2[1] - a1[1];
        }).map(a => a[0]);

        return [
            {
                title : 'Manual order',
                tabs : tabs.sort((a, b) => {
                    return a.index < b.index;
                })
            },
            {
                title : 'Domain',
                tabs : tabsWithSameDomain
            },
            {
                title : 'Title Similarity',
                tabs : tabSimilarity
            }
        ]
    }

    async getTabById(tabId) {
        let tab = await polyfillBrowser.tabs.get(tabId);
        return tab;
    }

    async updateTabs() {
        const tabLists = await this.getTabLists();
        const currentTab = await this.getCurrentTab();
        updateTabLists(tabLists);
        updateCurrentTab(currentTab);
    }

    initializeEventListeners() {
        polyfillBrowser.tabs.onCreated.addListener(
            (tab) => this.onTabCreated(tab)
        );
        polyfillBrowser.tabs.onRemoved.addListener(
            (tabId, info) => this.onTabRemoved(tabId, info)
        );
        polyfillBrowser.tabs.onUpdated.addListener(
            (tabId, info, tab) => this.onTabUpdated(tabId, info, tab)
        );
        polyfillBrowser.tabs.onActivated.addListener(
            (activeInfo) => this.onTabActivated(activeInfo)
        )
    }

    onTabCreated (tab) {
        this.updateTabs();
    }

    onTabRemoved (tabId, info) {
        this.updateTabs();
    }

    onTabUpdated(tabId, info, tab) {
        this.updateTabs();
    }

    async onTabActivated(activeInfo) {
        if (! activeInfo) {
            return;
        }
        const tab = await this.getTabById(activeInfo.tabId);
        if (! tab) {
            return;
        }
        const isBrowserTab = isBrowserUrl(getTabUrl(tab));
        if (isBrowserTab) {
            return;
        }
        this.activeTabId = tab.id;
        this.updateTabs();
        updateCurrentTab(tab);
    }
}

export default BrowserMediator;