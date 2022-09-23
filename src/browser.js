import polyfillBrowser from '../public/polyfillBrowser.js';
import * as FastDiceCoefficient from './lib/fast-dice-coefficient/dice.js';
const sorensenDice = FastDiceCoefficient.dice;
import {updateTabLists, updateCurrentTab, updateExtensionStorage, updateBookmarkLists, expectingTabClose, updateExpectingTabClose} from './stores.js';
import {get} from 'svelte/store';
import {getTabById, getTabUrl, isExtensionUrl} from '../public/common.js';

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

function stringToTokens(str) {
    if (! str) {
        return [];
    }
    return str.toLowerCase().match(/[a-zA-Z]+/gi)
}

function arrIsEmpty(arr) {
    return Array.isArray(arr) && arr.length == 0;
}

// is a class because might hold persistent data structures
class BrowserMediator {
    constructor () {
        this.flattenedBookmarks = null;
        this.initializeActiveTabId();
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
        if (Array.isArray(tab)) {
            tab = tab[0];
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

    getMostSimilar(tabOrBookmarkArr, title) {
        if (! tabOrBookmarkArr || ! Array.isArray(tabOrBookmarkArr)) {
            return [];
        }
        const minimumSimilarity = 0.25;
        const tabSimilarity = tabOrBookmarkArr.map(tabOrBookmark => {
            // const titleTokens = stringToTokens(tabOrBookmark.title);
            const similarity = sorensenDice(title ?? '', tabOrBookmark.title ?? '')
            return [tabOrBookmark, similarity];
        })
        .filter(a => a[1] >= minimumSimilarity)
        return tabSimilarity;
    }

    getTabsOrderedByParent(tabs) {
        // observation: even with 800 tabs, openerTabId is usually undefined
        // therefore this function is useless

        const tabsByIdDict = Object.fromEntries(tabs.map(tab => [tab?.id, tab]));

        // parentId : tab
        const fromSameParentDict = {};
        let tabsWithoutParent = [];
        tabs.forEach(tab => {
            if (! tab) {
                return;
            }
            if (tab.openerTabId == null) {
                tabsWithoutParent.push(tab);
                return;
            }
            if (fromSameParentDict[tab.openerTabId] == null) {
                fromSameParentDict[tab.openerTabId] = [];
            }
            fromSameParentDict[tab.openerTabId].push(tab);
        })
        // removes parents
        tabsWithoutParent = tabsWithoutParent.filter(tab => {
            return ! fromSameParentDict[tab?.id];
        })

        const orderedByParent = [];
        Object.entries(fromSameParentDict).forEach(entry => {
            if (! entry) {
                return;
            }
            const [parentId, tabsFromSameParent] = entry;
            if (! parentId) {
                return;
            }
            const parent = tabsByIdDict[parentId];
            if (parent) {
                orderedByParent.push(parent);
            }
            orderedByParent.push(...(tabsFromSameParent ?? []));
        })
        orderedByParent.push(...tabsWithoutParent);
        return orderedByParent;
    }

    // ps: some browsers such as vivaldi won't have a history for opened tabs because they were opened too long ago
    // when that happens, the first visit of the current tab will have happened just now
    async getTabsAccessedAroundSameTime(tabs, currentTab, hours=48) {
        if (! tabs || ! currentTab) {
            return [];
        }
        const minutes = hours * 60;
        const seconds = minutes * 60;
        const currentTabVisits = await polyfillBrowser.history?.getVisits({url : currentTab.url}) ?? {};
        if (! currentTabVisits || currentTabVisits.length == 0) {
            return [];
        }
        const startTime = currentTabVisits[0].visitTime - seconds;
        const endTime = currentTabVisits[0].visitTime + seconds;
        const urlsVisited = await polyfillBrowser.history?.search({text: '', startTime : startTime, endTime: endTime}) ?? [];
        const urlsVisitedDict = Object.fromEntries(urlsVisited.map(x => [x.url, true]));
        const accessedAroundSameTime = tabs.filter(tab => {
            return tab.url in urlsVisitedDict;
        })
        return accessedAroundSameTime;
    }

    async getTabLists() {
        const tabs = await this.getTabsFromCurrentWindow();
        const currentTab = await this.getCurrentTab();
        if (! tabs || ! currentTab || currentTab.length == 0) {
            return [];
        }

        const manualOrderComparison = (a1, a2) => {
            return a1.index - a2.index;
        }

        const aroundSameTime = await this.getTabsAccessedAroundSameTime(tabs, currentTab);

        const currentTabUrl = getTabUrl(currentTab);
        const domain = getDomain(currentTabUrl);
        const currentTabUrlObject = new URL(currentTabUrl);
        const isSameDomain = (tab) => {
            const tabUrl = getTabUrl(tab);
            const tabDomain = getDomain(tabUrl);
            // consider browser tabs such as about:config and extensions page
            // as having the same domain
            if (! tabDomain) {
                const tabUrlObject = new URL(tabUrl);
                return tabUrlObject && currentTabUrlObject && tabUrlObject.protocol == currentTabUrlObject.protocol;
            }
            return domain && tabDomain == domain;
        }
        const isSameDomainArr = tabs.map(tab => {
            return isSameDomain(tab);
        })
        const tabsWithSameDomain = tabs.filter((tab, index) => {
            return isSameDomainArr[index];
        })
        .sort(manualOrderComparison);
        const tabsWithoutSameDomain = tabs.filter((tab, index) => {
            return !isSameDomainArr[index];
        })
        
        // const currentTitleTokens = stringToTokens(currentTab.title);
        const tabSimilarity = this.getMostSimilar(tabsWithoutSameDomain, currentTab.title ?? '')
        .sort((a1, a2) => {
            if (a1[1] == a2[1]) {
                return manualOrderComparison(a1, a2);
            }
            return a2[1] - a1[1];
        }).map(a => a[0]);

        return [
            {
                title : 'Manual order',
                tabs : tabs.sort(manualOrderComparison)
            },
            {
                title : 'Domain',
                tabs : tabsWithSameDomain,
            },
            {
                title : 'Title Similarity',
                tabs : tabSimilarity,
            },
            {
                title : 'Access',
                tabs: aroundSameTime
            },
        ]
    }

    async getBookmarkLists () {
        const currentTab = await this.getCurrentTab();
        const bookmarks = await this.getFlattenedBookmarks() ?? [];
        if (! bookmarks || ! currentTab || currentTab.length == 0) {
            return [];
        }

        const domain = getDomain(getTabUrl(currentTab));
        const isSameDomain = (bookmark) => {
            return domain && getDomain(bookmark?.url ?? '') == domain;
        }
        const isSameDomainArr = bookmarks.map(bookmark => isSameDomain(bookmark));
        const bookmarksWithSameDomain = bookmarks.filter((bookmark, index) => {
            return isSameDomainArr[index];
        })
        const bookmarksWithoutSameDomain = bookmarks.filter((bookmark, index) => {
            return ! isSameDomainArr[index];
        })
        const bookmarksSimilarity = this.getMostSimilar(bookmarksWithoutSameDomain, currentTab.title ?? '').map(a => a[0]);

        const bookmarkLists = {
            'Domain' : {
                bookmarks : bookmarksWithSameDomain
            },
            'Title Similarity' : {
                bookmarks : bookmarksSimilarity
            }
        };
        return bookmarkLists;
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

    async updateBookmarks() {
        const bookmarkLists = await this.getBookmarkLists();
        updateBookmarkLists(bookmarkLists);
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
        const tabCloseDict = get(expectingTabClose) ?? {};
        if (tabCloseDict[tabId]) {
            // when user closes the tab from inside the extension
            // the tab lists are updated during close
            updateExpectingTabClose(tabId, undefined);
            return;
        }
        this.updateTabs();
    }

    onTabUpdated(tabId, info, tab) {
        this.updateTabs();
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
        this.updateTabs();
        this.updateBookmarks();
        updateCurrentTab(tab);
    }

    async initializeActiveTabId() {
        const message = {
            messageType : 'getLastAccessedNonExtensionTab'
        }
        const browserMediator = this;
        polyfillBrowser.runtime.sendMessage(message, {}, function(response) {
            if (response?.tabId == null) {
                return;
            }
            const fn = async () => {
                const tab = await getTabById(response.tabId);
                await browserMediator.setActiveTabId(tab);
            }
            fn();
        });
    }

    async onTabActivated(activeInfo) {
        if (! activeInfo) {
            return;
        }
        const tab = await getTabById(activeInfo.tabId);
        await this.setActiveTabId(tab);
    }

    flattenBookmarksTree(root) {
        if (! root) {
            return [];
        }
        const nodes = [];
        const stack = [root];
        while (stack.length > 0) {
            const current = stack.pop();
            if (! current) {
                continue;
            }
            if (current.type == 'bookmark' || current.url != null) {
                nodes.push(current);
                continue;
            }
            else {
                if (Array.isArray(current?.children)) {
                    stack.push(...current.children);
                }
            }
        }
        return nodes;
    }

    flattenBookmarksTreeRecursive(root) {
        if (! root) {
            return [];
        }
        const nodes = [];
        const recursion = (node) => {
            if (node.type == 'bookmark' || node.url != null) {
                nodes.push(node);
            }
            else {
                if (Array.isArray(node?.children)) {
                    node.children.forEach(childNode => {
                        recursion(childNode);
                    })
                }
            }
        }
        recursion(root);
        return nodes;
    }

    async getBookmarksTree() {
        const bookmarks = await polyfillBrowser.bookmarks.getTree();
        return bookmarks;
    }

    async getFlattenedBookmarks() {
        // expensive operation, end user won't care if bookmarks are updated
        // if (this.flattenedBookmarks) {
        //     return this.flattenedBookmarks;
        // }
        const bookmarks = await this.getBookmarksTree();
        console.log(bookmarks);
        if (! bookmarks || bookmarks.length == 0) {
            return [];
        }
        const root = bookmarks[0];
        const flattenedBookmarks = this.flattenBookmarksTree(root);
        flattenedBookmarks.forEach(bookmark => {
            if (! bookmark) {
                return;
            }
            bookmark.type = 'bookmark';
        })
        // this.flattenedBookmarks = flattenedBookmarks;
        console.log(flattenedBookmarks);
        return flattenedBookmarks;
    }
}

export default BrowserMediator;