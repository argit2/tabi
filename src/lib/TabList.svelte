<script>
export let tabList;
</script>

<div class="flex-col max-w-md">
    <div class="flex flex-row ml-4 mr-4 text-lg">{ tabList.title }</div>
    <div class="border border-black rounded divide-y">
        {#each tabList.tabs as { title, url, favIconUrl}, i}
        <div class="flex flex-row ml-4 mr-4">
            <div class="w-full overflow-hidden">
                <div class="flex flex-row w-full">
                    <div class="block w-4 h-4 min-w-4 min-h-4 self-center">
                        <img class="w-full h-full self-center" src="{favIconUrl}" alt="" title="{title}">
                    </div>
                    <div class="text-base text-truncate whitespace-nowrap w-full" title="{title}">{title}</div>
                </div>
                <div class="text-xs text-truncate break-all whitespace-nowrap w-full" title="{url}">{url}</div>
            </div>
        </div>
        {/each}
    </div>
</div>
