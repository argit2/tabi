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

// initializes tab trees and handles interactions between browser and the tab trees
// rationale for class: encapsulation.
// functions operate on the same variable and cause side effects
// better to encapsulate than to have a lot of functions laying around that
// modify a global variable

class TabBackgroundWorker {
    constructor () {
        this.multipleTabsTree = new MultipleTabTrees({treeOptionsArr : treeOptionsArr});
        this.initializeCurrentTabs();
        this.setReplyToSvelte();
    }

    async initializeCurrentTabs() {
        const tabs = await chrome.tabs.query({});
        console.log(tabs);
        tabs.forEach(tab => {
            this.multipleTabsTree.insert(tab);
        });
    }

    async setReplyToSvelte() {
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            console.log('Received request', request, sender);
            sendResponse = sendResponse == null ? () => null : sendResponse;
            switch (request?.messageType) {
                case 'getTabs':
                    // placeholder just to check if it's being passed
                    sendResponse({
                        tabLists: []
                    })
                    break;
                default:
                    console.log('Unknown messageType', request);
                    break;
            }
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
                        console.log('Response', response);
                        clearInterval(interval);
                    }
                });
            }
            catch (e) {
                console.log(e);
            }
        }, 1000);
    }

    initializeCallBacks() {
        chrome.tabs.onCreated.addListener(
            this.onTabCreated
        );
        chrome.tabs.onRemoved.addListener(
            this.onTabRemoved
        );
        chrome.tabs.onUpdated.addListener(
            this.onTabUpdated
        );
    }

    onTabCreated (tab) {
        this.multipleTabsTree.insert(tab);
    }

    onTabRemoved (tabId, info) {
        this.multipleTabsTree.remove(tabId);
    }

    onTabUpdated(tabId, info, tab) {
        this.multipleTabsTree.update(tabId, tab);
    }
}

var $tabBackgroundWorker = new TabBackgroundWorker();