<script>
    import TabList from './TabList.svelte'
    import {tabLists} from '../stores.js';
</script>

<div class="grid grid-cols-4 gap-4">
    {#each $tabLists as tabList, i}
    <TabList tabList={tabList} />
    {/each}
</div>
