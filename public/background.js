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

import * as FastDiceCoefficient from './lib/fast-dice-coefficient/dice.js';
const sorensenDice = FastDiceCoefficient.dice;

// tree of tabs ordered according to a criteria, and indexed to support querying
// by tab id
// rationale for using class: interface being independent from library, indexing
class TabsTree {
    constructor (options={
        sortingFunction : (a, b) => 0,
        indexBy : 'tabId'
    }) {
        this.options = options;
        this.indexDict = {};
    }

    insert(item) {

    }

    find(item) {

    }

    remove(id) {

    }

    slice(bottom, top) {

    }

    sliceAround(item, left, right) {

    }

    update(id, newItem) {
        // remove old and reinsert new?

    }
}

const treeOptionsArr = [
    {
        key : 'domain',
        options : {
            sortingFunction : (a, b) => {
                return a.localeCompare(b);
            }
        }
    },
    {
        key : 'title',
        options : {
            sortingFunction : (a, b) => {

            }
        }
    },
    {
        key : 'similarity',
        options : {
            sortingFunction : (a, b) => {

            }
        }
    },
    {
        key : 'date',
        options : {
            sortingFunction : (a, b) => {

            }
        }
    },
    {
        key : 'manualOrder',
        options : {
            sortingFunction : (a, b) => {
                return a.index < b.index;
            }
        }
    }
]

// insert and remove from multiple trees at once
// rationale for using class: multiple operations using the same data
class MultipleTabTrees {
    constructor (options={
        treeOptionsArr : {}
    }) {
        this.options = options;

        this.treeArr = options.treeOptionsArr.map(entry => {
            const {key, options} = entry;
            const tree = new TabsTree(options);
            return {key : key, tree : tree};
        })

        this.treeDict = Object.fromEntries(this.treeArr.map(dict => [dict.key, dict]));
    }

    insert(item) {
        this.treeArr.forEach(dict => {
            const {key, tree} = dict;
            tree.insert(item);
        })
    }

    remove(id) {
        this.treeArr.forEach(dict => {
            const {key, tree} = dict;
            tree.remove(id);
        })
    }

    slice(bottom, top) {
        return this.treeArr.map(dict => {
            const {key, tree} = dict;
            const result = tree.slice(bottom, top);
            return {key : key, tree : tree, result : result};
        })
    }

    sliceAround(item, left, right) {
        return this.treeArr.map(dict => {
            const {key, tree} = dict;
            const result = tree.sliceAround(item, left, right);
            return {key : key, tree : tree, result : result};
        })
    }

    update(id, newItem) {
        this.treeArr.forEach(dict => {
            const {key, tree} = dict;
            tree.update(id, newItem);
        })
    }
}

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
    const usesBrowserProtocol = !! urlObject.protocol?.match(/browser|chrome|firefox|vivaldi|brave|opera/gi);
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

// initializes tab trees and handles interactions between browser and the tab trees
// rationale for class: encapsulation.
// functions operate on the same variable and cause side effects
// better to encapsulate than to have a lot of functions laying around that
// modify a global variable

function stringToTokens(str) {
    if (! str) {
        return [];
    }
    return str.toLowerCase().match(/[a-zA-Z]+/gi)
}

class TabBackgroundWorker {
    constructor () {
        this.multipleTabsTree = new MultipleTabTrees({treeOptionsArr : treeOptionsArr});
        this.initializeCurrentTabs();
        this.initializeEventListeners();
        this.setReplyToSvelte();
    }

    async initializeCurrentTabs() {
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
            this.multipleTabsTree.insert(tab);
        });

        const history = await chrome.history.search({text : ''});
        const visits = await Promise.all(tabs.map(async tab => {
            return chrome.history.getVisits({url : getTabUrl(tab)})

        }));
        console.log(history);
        console.log(visits)
    }

    async getCurrentTab() {
        let tab = null;
        if (this.activeTabId != null) {
            tab = await chrome.tabs.get(this.activeTabId);
        }
        tab = tab ?? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
        return tab;

    }

    async getTabLists() {
        const tabs = await chrome.tabs.query({});
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

    async replyToSvelte(request, sender, sendResponse) {
        sendResponse = sendResponse == null ? () => null : sendResponse;
        switch (request?.messageType) {
            case 'getTabs':
                const tabLists = await this.getTabLists();
                const currentTab = await this.getCurrentTab();
                sendResponse({
                    tabLists: tabLists,
                    currentTab : currentTab,
                })
                break;
            default:
                console.log('Unknown messageType', request);
                break;
        }
    }

    async setReplyToSvelte() {
        const backgroundWorker = this;
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            backgroundWorker.replyToSvelte(request, sender, sendResponse);
            return true; // enables sendResponse asynchronous
        });
    }
    
    async sendDataToSvelte() {
        // placeholder just to check if it's being passed
        let interval = setInterval(async () => {
            try {
                const tabs = await chrome.tabs.query({});
                console.log('sending message');
                chrome.runtime.sendMessage({tabLists: [tabs]}, {}, function(response) {
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

    initializeEventListeners() {
        chrome.tabs.onCreated.addListener(
            (tab) => this.onTabCreated(tab)
        );
        chrome.tabs.onRemoved.addListener(
            (tabId, info) => this.onTabRemoved(tabId, info)
        );
        chrome.tabs.onUpdated.addListener(
            (tabId, info, tab) => this.onTabUpdated(tabId, info, tab)
        );
        chrome.tabs.onActivated.addListener(
            (activeInfo) => this.onTabActivated(activeInfo)
        )
    }

    onTabCreated (tab) {
        // this.multipleTabsTree.insert(tab);
    }

    onTabRemoved (tabId, info) {
        // this.multipleTabsTree.remove(tabId);
    }

    onTabUpdated(tabId, info, tab) {
        // this.multipleTabsTree.update(tabId, tab);
    }

    async onTabActivated(activeInfo) {
        if (! activeInfo) {
            return;
        }
        const tab = await chrome.tabs.get(activeInfo.tabId);
        const isBrowserTab = isBrowserUrl(getTabUrl(tab));
        if (isBrowserTab) {
            return;
        }
        this.activeTabId = tab.id;
    }
}

var $tabBackgroundWorker = new TabBackgroundWorker();