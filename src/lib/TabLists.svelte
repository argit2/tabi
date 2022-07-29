<script>
    import TabList from './TabList.svelte'
    import {tabLists} from '../stores.js';
</script>

{#each $tabLists as list, i}
    <TabList tabs={list} />
{/each}
