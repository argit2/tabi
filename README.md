![Tabi logo](./public/icons/icon_128.png)
# Tabi

Tabi is a browser extension created to help users with too many tabs, without the need to spend effort with manual ordering.

- Lots of social media tabs? View tabs from the same site all in the same place, no need to organize them yourself!
- Researching about a topic? Mark important tabs and tabs you already read
- Finished researching? See tabs about the same topic in the same place and close them all!

## Concept

This extension was made as part of my bachelor's thesis

- The current design of browser tabs does not attend to user needs
- The design often leads to
  - Tab hoarding: you have too many tabs
  - Black hole effect: old tabs go out of your view
- Tabs don't have enough contextual information
- Other extensions attempt to solve the issue by helping the user manually order the tabs into categories
- Manually ordering tabs takes effort and doesn't solve the issue for hundreds of tabs
- This extension tries to solve the problem by
  - Using an alternative design for displaying tabs that allows the users to see more information and related tabs
  - Organizing tabs with as little user input as possible
  - Allowing the user to add more contextual data to the tabs, such as whether the tab was already read or not.

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