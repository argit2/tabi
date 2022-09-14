import polyfillBrowser from './polyfillBrowser.js';
import * as FastDiceCoefficient from './lib/fast-dice-coefficient/dice.js';
const sorensenDice = FastDiceCoefficient.dice;
import {updateTabLists, updateCurrentTab, updateExtensionStorage, updateBookmarkLists, expectingTabClose, updateExpectingTabClose} from './stores.js';
import {get} from 'svelte/store';

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

// is a class because might hold persistent data structures
class BrowserMediator {
    constructor () {
        this.flattenedBookmarks = null;
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

    async getTabLists() {
        const tabs = await this.getTabsFromCurrentWindow();
        const currentTab = await this.getCurrentTab();
        if (! tabs || ! currentTab || currentTab.length == 0) {
            return [];
        }

        const manualOrderComparison = (a1, a2) => {
            return a1.index - a2.index;
        }

        const domain = getDomain(getTabUrl(currentTab));
        const tabsWithSameDomain = tabs.filter(tab => {
            return domain && getDomain(getTabUrl(tab)) == domain;
        })
        .sort(manualOrderComparison);
        
        // const currentTitleTokens = stringToTokens(currentTab.title);
        const tabSimilarity = this.getMostSimilar(tabs, currentTab.title ?? '')
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
                tabs : tabsWithSameDomain,
            },
            {
                title : 'Title Similarity',
                tabs : tabSimilarity,
            }
        ]
    }

    async getBookmarkLists () {
        const currentTab = await this.getCurrentTab();
        const bookmarks = await this.getFlattenedBookmarks() ?? [];
        if (! bookmarks || ! currentTab || currentTab.length == 0) {
            return [];
        }

        const domain = getDomain(getTabUrl(currentTab));
        const bookmarksWithSameDomain = bookmarks.filter(bookmark => {
            return domain && getDomain(bookmark?.url ?? '') == domain;
        })
        const bookmarksSimilarity = this.getMostSimilar(bookmarks, currentTab.title ?? '').map(a => a[0]);

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
        this.updateBookmarks();
        updateCurrentTab(tab);
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