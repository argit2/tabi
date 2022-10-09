<script>
import VirtualList from '@sveltejs/svelte-virtual-list';
import { tabLists, updateTabLists, storage, setTabProperty, processUrlToPutOnStorage, getUrlData, importantTabs, toReadTabs, updateRelevantTabs, updateToReadTabs, updateExpectingTabClose} from "../stores.js";
import polyfillBrowser from '../../public/polyfillBrowser.js';
import _ from 'lodash';

export let tabList;
export let currentTab;
export let bookmarkList;
function onTabClick(tabId) {
    polyfillBrowser.tabs.update(tabId, {active: true})
}

function onBookmarkClick(url) {
    if (url == null) {
        return;
    }
    polyfillBrowser.tabs.create({
        active : true,
        url : url
    })
}

function onListItemClick(listItem) {
    if (! listItem) {
        return;
    }
    if (listItem.type === 'bookmark') {
        onBookmarkClick(listItem.url);
    }
    else {
        onTabClick(listItem.id);
    }
}

const readIconDict = {
    0 : 'fa-regular fa-eye-slash',
    1 : 'fa-solid fa-book',
    2 : 'fa-solid fa-square-check',
}

const readTitleDict = {
    0 : 'Not read',
    1 : 'Want to read',
    2 : 'Completed',
}

const readStates = Object.keys(readIconDict).length;

const iconContainerClasses = 'self-center self-justify-center flex w-5 h-6 items-center justify-items-center rounded hover:bg-zinc-300 dark:hover:bg-zinc-600'
const iconClasses = 'text-sm self-center self-justify-center m-auto';

function onClickRelevant(url) {
    url = processUrlToPutOnStorage(url);
    const data = getUrlData(url);
    setTabProperty(url, 'relevant', ! data?.relevant)
    updateRelevantTabs();
}

function onClickRead(url) {
    url = processUrlToPutOnStorage(url);
    const data = getUrlData(url);
    const oldValue = (data?.read ?? 0);
    const newValue = (oldValue + 1) % readStates;
    setTabProperty(url, 'read', newValue);
    updateRelevantTabs();
}

function onClickClose(tabId) {
    updateExpectingTabClose(tabId, true);
    polyfillBrowser.tabs.remove(tabId);

    // update the tab lists here instead of on event listener
    // this is so we don't have to wait for the browser to remove the tab
    // for the app to update
    const newTabLists = _.clone($tabLists);
    newTabLists?.forEach(tabList => {
        if (! tabList) {
            return;
        }
        tabList.tabs = tabList?.tabs?.filter(tab => tab.id != tabId) ?? [];
    })
    updateTabLists(newTabLists);
}

</script>

<div class="flex flex-col justify-items-center justify-center max-w-full h-full {tabList.title?.includes("Manual order") ? 'row-start-1 row-end-4' : 'row-span-1'} md:row-auto">
    <div class="ml-4 mr-4 text-md max-h-10 h-7">{ tabList.title }</div>
    <div class="border-t border-b md:border border-black dark:border-zinc-400 rounded divide-y overflow-auto grow">
        <VirtualList items={[...(tabList?.tabs ?? []), ...(bookmarkList?.bookmarks ?? [])]} let:item>
        <div class="flex flex-row ml-4 mr-4 cursor-pointer hover:border-l-zinc-600 dark:hover:border-l-zinc-400 border-l-2 border-l-transparent {item.id == currentTab.id ? 'bg-zinc-200 dark:bg-zinc-600' : ''}" title="{item.title + '\n' + item.url}">
            <div class="w-full overflow-hidden ml-1"  on:click={() => onListItemClick(item)}>
                <div class="flex flex-row w-full">
                    {#if item?.type === 'bookmark'}
                    <div class="flex w-4 h-4 min-w-max min-h-max items-center justify-items-center self-center">
                        <i class="w-4 h-4 fa-solid fa-bookmark self-center text-sm self-justify-center m-auto text-center"></i>
                    </div>
                    {:else}
                    <div class="block w-4 h-4 min-w-max min-h-max self-center">
                        <img class="w-4 h-4 self-center" src="{item.favIconUrl}" alt="">
                    </div>
                    {/if}
                    <div class="text-sm text-truncate whitespace-nowrap w-full">{item.title}</div>
                </div>
            </div>
            {#if item?.type !== 'bookmark'}
            <div class="flex flex-row pl-2 pr-1 gap-1">
                <div class="{iconContainerClasses}" on:click={() => onClickRelevant(item.url)}>
                    <i class="fa-star {iconClasses} {$storage.urlData[processUrlToPutOnStorage(item.url)]?.relevant ? 'fa-solid text-amber-300' : 'fa-regular' }" title="Relevant"></i>
                </div>
                <div class="{iconContainerClasses}" on:click={() => onClickRead(item.url)}>
                    <i class="{readIconDict[$storage.urlData[processUrlToPutOnStorage(item.url)]?.read ?? 0]} {iconClasses}" title="{readTitleDict[$storage.urlData[processUrlToPutOnStorage(item.url)]?.read ?? 0]}"></i>
                </div>
                <div class="{iconContainerClasses} cursor-default" on:click={() => onClickClose(item.id)}>
                    <i class="fa-solid fa-xmark {iconClasses}" title="Close"></i>
                </div>
            </div>
            {/if}
        </div>
        </VirtualList>
    </div>
</div>
