import './app.css'
import App from './App.svelte'
import {updateTabLists, updateCurrentTab, updateExtensionStorage} from './stores.js';
import polyfillBrowser from '../public/polyfillBrowser.js';
import BrowserMediator from './browser.js';

const app = new App({
  target: document.getElementById('app')
})

class Tabi {
  constructor () {
    this.browserMediator = new BrowserMediator();
  }
  
  async initializeExtension() {
    updateExtensionStorage();
    await this.browserMediator.initializeActiveTabId();
    await this.browserMediator.updateTabs();
    await this.browserMediator.updateBookmarks();
    await this.browserMediator.initializeEventListeners();
  }

}
const tabi = new Tabi();
tabi.initializeExtension();

export default app
