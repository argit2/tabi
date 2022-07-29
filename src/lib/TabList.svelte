<script>
export let tabs;
</script>

<div class="flex-col border border-black divide-y max-w-md">
    {#each tabs as { title, url, favIconUrl}, i}
    <div class="flex flex-row ml-4 mr-4">
        <div>
            <div class="flex flex-row">
                <div class="block w-4 h-4 self-center">
                    <img class="w-full h-full self-center" src="{favIconUrl}" alt="">
                </div>
                <div class="text-base">{title}</div>
            </div>
            <div class="text-xs">{url}</div>
        </div>
    </div>
    {/each}
</div>
