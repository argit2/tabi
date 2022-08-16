<script>
export let tabList;
function onClick(tabId) {
    chrome.tabs.update(tabId, {active: true})
}
</script>

<div class="flex-col max-w-md">
    <div class="flex flex-row ml-4 mr-4 text-lg">{ tabList.title }</div>
    <div class="border border-black rounded divide-y">
        {#each tabList.tabs as { title, url, favIconUrl, id}, i}
        <div class="flex flex-row ml-4 mr-4 cursor-pointer hover:border-l-slate-500 border-l-2 border-l-transparent" on:click={() => onClick(id)}>
            <div class="w-full overflow-hidden ml-1">
                <div class="flex flex-row w-full">
                    <div class="block w-4 h-4 min-w-max min-h-max self-center">
                        <img class="w-4 h-4 self-center" src="{favIconUrl}" alt="" title="{title}">
                    </div>
                    <div class="text-base text-truncate whitespace-nowrap w-full" title="{title}">{title}</div>
                </div>
                <div class="text-xs text-truncate break-all whitespace-nowrap w-full" title="{url}">{url}</div>
            </div>
        </div>
        {/each}
    </div>
</div>
