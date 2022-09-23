let polyfillBrowser;
if (typeof browser !== 'undefined') {
    polyfillBrowser = browser;
}
else {
    polyfillBrowser = chrome;
}

export default polyfillBrowser;