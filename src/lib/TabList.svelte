<script>
import VirtualList from '@sveltejs/svelte-virtual-list';
import { tabLists, updateTabLists, storage, setTabProperty, processUrlToPutOnStorage, getUrlData, importantTabs, toReadTabs, updateRelevantTabs, updateToReadTabs} from "../stores.js";
import polyfillBrowser from '../polyfillBrowser.js';
import _ from 'lodash';

export let tabList;
export let currentTab;
function onTabClick(tabId) {
    polyfillBrowser.tabs.update(tabId, {active: true})
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

const iconContainerClasses = 'self-center self-justify-center flex w-5 h-6 items-center justify-items-center rounded hover:bg-slate-300'
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
    updateToReadTabs();
}

function onClickClose(tabId) {
    polyfillBrowser.tabs.remove(tabId);
    const newTabLists = _.clone($tabLists);
    newTabLists?.forEach(tabList => {
        if (! tabList) {
            return;
        }
        tabList.tabs = tabList?.tabs?.filter(tab => tab.id != tabId) ?? [];
    })
    updateTabLists(newTabLists)
}

</script>

<div class="flex-col max-w-md h-full">
    <div class="flex flex-row ml-4 mr-4 text-lg">{ tabList.title }</div>
    <div class="border border-black rounded divide-y overflow-auto h-5/6">
        <VirtualList items={tabList?.tabs ?? []} let:item>
        <div class="flex flex-row ml-4 mr-4 cursor-pointer hover:border-l-slate-500 border-l-2 border-l-transparent {item.id == currentTab.id ? 'bg-slate-200' : ''}" title="{item.title + '\n' + item.url}">
            <div class="w-full overflow-hidden ml-1"  on:click={() => onTabClick(item.id)}>
                <div class="flex flex-row w-full">
                    <div class="block w-4 h-4 min-w-max min-h-max self-center">
                        <img class="w-4 h-4 self-center" src="{item.favIconUrl}" alt="">
                    </div>
                    <div class="text-sm text-truncate whitespace-nowrap w-full">{item.title}</div>
                </div>
            </div>
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
        </div>
        </VirtualList>
    </div>
</div>
