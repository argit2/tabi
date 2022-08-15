import { writable, readable } from 'svelte/store';
import { ExtensionStorage  } from './storage';

const extensionStorage = new ExtensionStorage();

export let tabLists = writable([]);
export let storage = writable({});

export function updateTabLists(newTabLists) {
    tabLists.update(oldTabLists => newTabLists)
}

export function updateExtensionStorage() {
    const newStorage = extensionStorage.get();
    storage.update(oldStorage => newStorage);
}