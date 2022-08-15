import './app.css'
import App from './App.svelte'
import {updateTabLists, updateExtensionStorage} from './stores.js';

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
    console.log('Response', response);
    if (! response?.tabLists) {
      callback({result : 'Received nothing'});
      return;
    }
    const {tabLists} = response;
    updateTabLists(tabLists);
  }
  chrome.runtime.sendMessage(message, callback);
}

updateExtensionStorage();
getTabs();

export default app
