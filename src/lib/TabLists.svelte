<script>
    import TabList from './TabList.svelte';
    import {tabLists, importantTabs, toReadTabs, bookmarkLists} from '../stores.js';
    import {currentTab} from '../stores.js';
</script>

<div class="grid md:grid-cols-4 md:grid-rows-2 grid-cols-1 grid-rows-8 gap-0 md:gap-4 h-screen max-h-screen auto-rows-fr">
    {#each [...$tabLists, $importantTabs].filter(x => x != null) as tabList, i}
    <TabList tabList={tabList} currentTab={$currentTab} bookmarkList={$bookmarkLists[tabList.title] ?? {}}/>
    {/each}
</div>
