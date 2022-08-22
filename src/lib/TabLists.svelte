<script>
    import TabList from './TabList.svelte';
    import {tabLists, importantTabs, toReadTabs} from '../stores.js';
    import {currentTab} from '../stores.js';
</script>

<div class="grid grid-cols-4 grid-rows-2 gap-4 h-screen">
    {#each [...$tabLists, $importantTabs, $toReadTabs] as tabList, i}
    <TabList tabList={tabList} currentTab={$currentTab}/>
    {/each}
</div>
