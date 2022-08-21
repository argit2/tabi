<script>
    import TabList from './TabList.svelte';
    import {tabLists} from '../stores.js';
    import {currentTab} from '../stores.js';
</script>

<div class="grid grid-cols-4 grid-rows-2 gap-4 max-h-screen">
    {#each $tabLists as tabList, i}
    <TabList tabList={tabList} currentTab={$currentTab}/>
    {/each}
</div>
