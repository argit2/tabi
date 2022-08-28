![Tabi logo](./public/icons/icon_128.png)
# Tabi

Tabi is a browser extension created to help users to visualize their tabs.

## Loading the extension

### Firefox

1) Access the url `about:config`
2) Set the flag `extensions.manifestV3.enabled` to true
3) Set the flag `xpinstall.signatures.required` to false
4) Open the add-ons page
5) Click on `Debug Add-ons`
6) Click on `Load Temporary Add-on`
7) Load the file `manifest.json` that is inside the `dist-firefox` folder

### Chrome, Edge, Opera, Brave, Vivaldi and other Chromium based browsers


1) Open the extensions page
2) Enable developer mode
3) Click on "Load unpacked"
4) Load the `dist` folder

## Building the extension

1) Run `npm run build` on the terminal
2) Go to the extensions page on your browser
3) Click the button that reloads the extension

## Built with

- Svelte
- Vite
- Tailwind
- FontAwesome