import './app.css'
import App from './App.svelte'
import {updateTabLists} from './stores.js';

const app = new App({
  target: document.getElementById('app')
})

chrome.runtime.onMessage.addListener(function(message, information, callback) {
  callback = callback == null ? () => null : callback;
  if (! message?.tabLists) {
    callback({result : 'Received nothing'});
    return;
  }
  const {tabLists} = message;
  console.log(tabLists);
  updateTabLists(tabLists);
  callback({result : 'Received'});
});

export default app
