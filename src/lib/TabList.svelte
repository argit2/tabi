<script>
import { storage, setTabProperty, processUrlToPutOnStorage} from "../stores.js";

export let tabList;
export let currentTab;
function onTabClick(tabId) {
    chrome.tabs.update(tabId, {active: true})
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

const iconContainerClasses = 'self-center self-justify-center flex w-5 h-6 items-center justify-items-center'
const iconClasses = 'text-base self-center self-justify-center m-auto';

function onClickRelevant(url) {
    setTabProperty(url, 'relevant', ! $storage.urlData[url]?.relevant)
}

function onClickRead(url) {
    const oldValue = ($storage.urlData[url]?.read ?? 0);
    const newValue = (oldValue + 1) % readStates;
    setTabProperty(url, 'read', newValue);
}
</script>

<div class="flex-col max-w-md">
    <div class="flex flex-row ml-4 mr-4 text-lg">{ tabList.title }</div>
    <div class="border border-black rounded divide-y">
        {#each tabList.tabs as { title, url, favIconUrl, id}, i}
        <div class="flex flex-row ml-4 mr-4 cursor-pointer hover:border-l-slate-500 border-l-2 border-l-transparent {id == currentTab.id ? 'bg-slate-200' : ''}">
            <div class="w-full overflow-hidden ml-1"  on:click={() => onTabClick(id)}>
                <div class="flex flex-row w-full">
                    <div class="block w-4 h-4 min-w-max min-h-max self-center">
                        <img class="w-4 h-4 self-center" src="{favIconUrl}" alt="" title="{title}">
                    </div>
                    <div class="text-base text-truncate whitespace-nowrap w-full" title="{title}">{title}</div>
                </div>
                <div class="text-xs text-truncate break-all whitespace-nowrap w-full" title="{url}">{url}</div>
            </div>
            <div class="flex flex-row pl-2 pr-1 gap-1">
                <div class="{iconContainerClasses}">
                    <i class="fa-star {iconClasses} {$storage.urlData[url]?.relevant ? 'fa-solid text-amber-300' : 'fa-regular' }" title="Relevant" on:click={() => onClickRelevant(url)}></i>
                </div>
                <div class="{iconContainerClasses}">
                    <i class="{readIconDict[$storage.urlData[url]?.read ?? 0]} {iconClasses}" title="{readTitleDict[$storage.urlData[url]?.read ?? 0]}" on:click={() => onClickRead(url)}></i>
                </div>
            </div>
        </div>
        {/each}
    </div>
</div>
