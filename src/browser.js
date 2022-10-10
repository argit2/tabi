import polyfillBrowser from '../public/polyfillBrowser.js';
import _ from 'lodash';
import * as FastDiceCoefficient from './lib/fast-dice-coefficient/dice.js';
import englishStopWordsDict from './englishStopWords.js';
const sorensenDice = FastDiceCoefficient.dice;
import {updateTabLists, updateCurrentTab, updateExtensionStorage, updateBookmarkLists, expectingTabClose, updateExpectingTabClose} from './stores.js';
import {get} from 'svelte/store';
import {getTabById, getTabUrl, isExtensionUrl, buildUrl} from '../public/common.js';

// warning: slow
function cloneObject(obj) {
    if (! obj) {
        return null;
    }

    return JSON.parse(JSON.stringify(obj));
}

function getDomainAndPrefix(url) {
    const defaultResult = {domain : '', prefix : ''};
    if (! url) {
        return defaultResult;
    }
    const urlObject = buildUrl(url);
    if (urlObject == null) {
        return defaultResult;
    }
    const hostname = urlObject.hostname;
    const split = hostname.split('.');
    if (split.length == 1) {
        return {
            prefix : '',
            domain : split[0]
        }
    }
    let prefix = '';
    if (split.length >= 3) {
        prefix = split[0];
    }
    // example: kit.svelte.dev should return svelte.dev
    // example2: blog.tumblr.com should return tumblr.com
    return {
        prefix: prefix, 
        domain: `${split[split.length - 2]}.${split[split.length -1]}`
    };
}

function isBrowserUrl(url) {
    if (! url) {
        return false;
    }
    const urlObject = buildUrl(url);
    if (urlObject == null) {
        return false;
    }
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

function removeStopWords(arr) {
    if (arr == null) {
        return null;
    }
    return arr.filter(x => ! englishStopWordsDict[x]);
}

function arrIsEmpty(arr) {
    return Array.isArray(arr) && arr.length == 0;
}

// Szymkiewicz–Simpson coefficient
function simpsonCoefficient(arr1, arr2) {
    if (arr1 == null || arr2 == null || arr1.length == 0 || arr2.length == 0) {
        return 0;
    }
    const numerator = _.intersection(arr1, arr2).length;
    const denominator = Math.min(arr1.length, arr2.length);
    const coefficient = numerator / denominator;
    return coefficient;
}

function intersectionCoefficient(arr1, arr2) {
    if (arr1 == null || arr2 == null || arr1.length == 0 || arr2.length == 0) {
        return 0;
    }
    const coefficient = _.intersection(arr1, arr2).length;
    return coefficient
}

function sorensenDiceModified(str1, str2) {
    if (!str1 || ! str2) {
        return 0;
    }
    const diceCoefficient = sorensenDice(str1, str2);
    const coefficient = diceCoefficient * (str1.length + str2.length);
    return coefficient;
}

function sorensenDiceByToken(arr1, arr2) {
    if (arr1 == null || arr2 == null || arr1.length == 0 || arr2.length == 0) {
        return 0;
    }
    arr1 = _.uniq(arr1);
    arr2 = _.uniq(arr2);

    let matches = 0;
    const minimumSimilarity = 0.7;
    for (const word1 of arr1) {
        for (const word2 of arr2) {
            const diceCoefficient = sorensenDice(word1, word2);
            if (diceCoefficient >= minimumSimilarity) {
                matches = matches + 1;
                break;
            }
        }
    }
    const coefficient = Math.ceil(matches / 2);
    return coefficient
}

// is a class because might hold persistent data structures
class BrowserMediator {
    constructor () {
        this.flattenedBookmarks = null;
    }

    async initializeCurrentTabs() {
        const tabs = await this.getTabsFromCurrentWindow();

        // const history = await polyfillBrowser.history.search({text : ''});
        // const visits = await Promise.all(tabs.map(async tab => {
        //     return polyfillBrowser.history.getVisits({url : getTabUrl(tab)})

        // }));
        // console.log(history);
        // console.log(visits)
    }

    async getCurrentTab() {
        let tab = null;
        if (this.activeTabId != null) {
            tab = await polyfillBrowser.tabs.get(this.activeTabId);
        }
        console.log('tab1', tab, this.activeTabId);
        if (tab == null) {
            tab = await polyfillBrowser.tabs.query({ active: true, currentWindow : true});
        }
        console.log('tab2', tab);
        if (tab == null || arrIsEmpty(tab)) {
            const windowId = await polyfillBrowser.windows.getCurrent()?.id;
            tab = await polyfillBrowser.tabs.query({active : true, windowId : windowId});
        }
        console.log('tab3', tab);
        if (Array.isArray(tab)) {
            tab = tab[0];
        }
        console.log('tab4', tab);
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

    async addGroupsToTabListChrome(tabArr) {
        if (! polyfillBrowser.tabGroups) {
            return tabArr;
        }
        let lastTabGroup = -1;
        const newTabArr = [];
        for (const tab of tabArr) {
            if (tab?.groupId != lastTabGroup) {
                lastTabGroup = tab?.groupId;

                if(tab?.groupId !== polyfillBrowser.tabGroups.TAB_GROUP_ID_NONE) {
                    const group = await polyfillBrowser.tabGroups.get(tab?.groupId);
                    if (group) {
                        group.isTabGroup = true;
                        newTabArr.push(group);
                    }
                }
            }
            newTabArr.push(tab);
        }
        console.log('group', tabArr, newTabArr);
        return newTabArr;
    }

    async addGroupsToTabList(tabArr) {
        // firefox doesn't have tab groups
        // it has containers, and they don't follow any hierarchy
        return await this.addGroupsToTabListChrome(tabArr);
    }

    getMostSimilarBySorensenDice(tabOrBookmarkArr, title) {
        if (! tabOrBookmarkArr || ! Array.isArray(tabOrBookmarkArr)) {
            return [];
        }
        // const minimumSimilarity = 0.25;
        let minimumSimilarity = 15;
        minimumSimilarity = Math.max(minimumSimilarity, 1);
        const tabSimilarity = tabOrBookmarkArr.map(tabOrBookmark => {
            const similarity = sorensenDiceModified(title ?? '', tabOrBookmark.title ?? '');
            return [tabOrBookmark, similarity];
        })
        const filtered = tabSimilarity.filter(a => a[1] >= minimumSimilarity)
        console.log(tabSimilarity);
        return filtered;
    }

    getMostSimilarBySorensenDice2(tabOrBookmarkArr, title) {
        if (! tabOrBookmarkArr || ! Array.isArray(tabOrBookmarkArr)) {
            return [];
        }
        title = title ?? '';
        const tabSimilarity = tabOrBookmarkArr.map(tabOrBookmark => {
            const tabOrBookmarkTitle = tabOrBookmark.title ?? '';
            if (tabOrBookmarkTitle.length == 0) {
                return 0;
            }
            const minimumSimilarity = 0.5 * Math.min(title.length / tabOrBookmarkTitle.length, tabOrBookmarkTitle.length / title.length);
            const similarity = sorensenDice(title, tabOrBookmarkTitle);
            return [tabOrBookmark, similarity, minimumSimilarity];
        })
        const filtered = tabSimilarity.filter(a => a[1] >= a[2])
        console.log(tabSimilarity);
        return filtered;
    }

    getMostSimilarBySorensenDiceByToken(tabOrBookmarkArr, titleTokens) {
        if (! tabOrBookmarkArr || ! Array.isArray(tabOrBookmarkArr)) {
            return [];
        }
        titleTokens = titleTokens ?? [];
        const minimumSimilarity = 1;
        const tabSimilarity = tabOrBookmarkArr.map(tabOrBookmark => {
            let tabTitleTokens = stringToTokens(tabOrBookmark.title ?? '') ?? [];
            tabTitleTokens = removeStopWords(tabTitleTokens) ?? [];
            // const similarity = intersectionCoefficient(titleTokens ?? [], tabTitleTokens);
            const similarity = sorensenDiceByToken(titleTokens, tabTitleTokens);
            return [tabOrBookmark, similarity];
        })
        console.log('tabSimilarity', tabSimilarity);
        const filtered = tabSimilarity.filter(a => a[1] >= minimumSimilarity)
        return filtered;
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
        const currentTabVisits = await polyfillBrowser.history?.getVisits({url : currentTab.url ?? ''}) ?? {};
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

        let manualOrderTabs = _.clone(tabs).sort(manualOrderComparison);
        manualOrderTabs = await this.addGroupsToTabList(manualOrderTabs);
        const manualOrderDict = {
            title : 'Manual order',
            tabs : manualOrderTabs
        };

        const currentTabUrl = getTabUrl(currentTab);
        const {domain, prefix} = getDomainAndPrefix(currentTabUrl);
        const currentTabUrlObject = buildUrl(currentTabUrl);
        if (currentTabUrlObject == null) {
            return [manualOrderDict];
        }
        const isSameDomain = (tab) => {
            const tabUrl = getTabUrl(tab);
            const tabDomainAndPrefix = getDomainAndPrefix(tabUrl);
            // consider browser tabs such as about:config and extensions page
            // as having the same domain
            if (! tabDomainAndPrefix.domain) {
                const tabUrlObject = buildUrl(tabUrl);
                return tabUrlObject && currentTabUrlObject && tabUrlObject.protocol == currentTabUrlObject.protocol;
            }
            return domain && tabDomainAndPrefix.domain == domain;
        }
        const isSameDomainArr = tabs.map(tab => {
            return isSameDomain(tab);
        })
        const tabsWithSameDomain = tabs.filter((tab, index) => {
            return isSameDomainArr[index];
        })
        .sort((tab1, tab2) => {
            const tab1Prefix = getDomainAndPrefix(tab1.url).prefix ?? '';
            const tab2Prefix = getDomainAndPrefix(tab2.url).prefix ?? '';
            if (tab1Prefix != tab2Prefix) {
                if (tab1Prefix === prefix) {
                    return -1;
                }
                if (tab2Prefix === prefix) {
                    return 1;
                }
                if (tab1Prefix && tab2Prefix) {
                    return tab1Prefix.localeCompare(tab2Prefix);
                }
            }
            return manualOrderComparison(tab1, tab2);
        });
        const tabsWithoutSameDomain = tabs.filter((tab, index) => {
            return !isSameDomainArr[index];
        })
        
        let currentTitleTokens = stringToTokens(currentTab.title);
        currentTitleTokens = removeStopWords(currentTitleTokens) ?? [];
        // const tabSimilarity = this.getMostSimilarBySorensenDice(tabsWithoutSameDomain, currentTab.title ?? '')
        // const tabSimilarity = this.getMostSimilarBySorensenDice2(tabsWithoutSameDomain, currentTab.title ?? '')
        const tabSimilarity = this.getMostSimilarBySorensenDiceByToken(tabsWithoutSameDomain, currentTitleTokens)
        .sort((a1, a2) => {
            if (a1[1] == a2[1]) {
                return manualOrderComparison(a1, a2);
            }
            return a2[1] - a1[1];
        }).map(a => a[0]);

        return [
            manualOrderDict,
            {
                title : 'Domain',
                tabs : tabsWithSameDomain,
            },
            {
                title : 'Title Similarity',
                tabs : tabSimilarity,
            },
        ]
    }

    async getBookmarkLists () {
        const currentTab = await this.getCurrentTab();
        let bookmarks = await this.getFlattenedBookmarks() ?? [];

        const bookmarksDict = Object.fromEntries(bookmarks.map(x => [x.url, x]));
        bookmarks = Object.values(bookmarksDict);
        if (! bookmarks || ! currentTab || currentTab.length == 0) {
            return [];
        }
        const manualOrderComparison = (a1, a2) => {
            return a1.index - a2.index;
        }
        const {domain, prefix} = getDomainAndPrefix(getTabUrl(currentTab));
        const isSameDomain = (bookmark) => {
            return domain && getDomainAndPrefix(bookmark?.url ?? '').domain == domain;
        }
        const isSameDomainArr = bookmarks.map(bookmark => isSameDomain(bookmark));
        const bookmarksWithSameDomain = bookmarks.filter((bookmark, index) => {
            return isSameDomainArr[index];
        })
        const bookmarksWithoutSameDomain = bookmarks.filter((bookmark, index) => {
            return ! isSameDomainArr[index];
        })
        let currentTitleTokens = stringToTokens(currentTab.title ?? '') ?? [];
        currentTitleTokens = removeStopWords(currentTitleTokens) ?? [];
        // const bookmarksSimilarity = this.getMostSimilarBySorensenDice(bookmarksWithoutSameDomain, currentTab.title ?? '');
        const bookmarksSimilarity = this.getMostSimilarBySorensenDiceByToken(bookmarksWithoutSameDomain, currentTitleTokens)
        .sort((a1, a2) => {
            if (a1[1] == a2[1]) {
                return manualOrderComparison(a1, a2);
            }
            return a2[1] - a1[1];
        }).map(a => a[0]);

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
        console.log('initializing active tab id')
        const browserMediator = this;
        polyfillBrowser.runtime.sendMessage(message, {}, function(response) {
            console.log('response', response);
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