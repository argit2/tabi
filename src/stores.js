import { writable, readable } from 'svelte/store';

export let tabLists = writable([]);

export function updateTabLists(newTabLists) {
    tabLists.update(oldTabLists => newTabLists)
}