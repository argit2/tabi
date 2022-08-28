import './app.css'
import App from './App.svelte'
import {updateTabLists, updateCurrentTab, updateExtensionStorage} from './stores.js';
import polyfillBrowser from './polyfillBrowser.js';

const app = new App({
  target: document.getElementById('app')
})

async function getTabs() {
  const message = {
    messageType: 'getTabs'
  }
  const callback = (response) => {
    if (! response) {
      return;
    }
    if (! response?.tabLists) {
      callback({result : 'Received nothing'});
      return;
    }
    const {tabLists, currentTab} = response;
    updateTabLists(tabLists);
    updateCurrentTab(currentTab);
  }
  polyfillBrowser.runtime.sendMessage(message, callback);
}

updateExtensionStorage();
getTabs();

export default app
