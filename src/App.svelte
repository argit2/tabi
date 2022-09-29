<svelte:head>
</svelte:head>

<script>
  import TabLists from './lib/TabLists.svelte';
  import {storage, setDarkMode, setFontSize, getFontSize} from './stores.js';
  import fontAwesome from "./assets/fontawesome-free-6.1.2-web/css/fontawesome.css";
  import fontAwesomeBrands from "./assets/fontawesome-free-6.1.2-web/css/brands.css";
  import fontAwesomeSolid from "./assets/fontawesome-free-6.1.2-web/css/solid.css";
  import fontAwesomeRegular from "./assets/fontawesome-free-6.1.2-web/css/regular.css";

  const iconContainerClasses = 'self-center self-justify-center flex w-[14px] h-[16px] items-center justify-items-center rounded hover:bg-zinc-300 dark:hover:bg-zinc-600'
  const iconClasses = 'text-[14px] self-center self-justify-center m-auto';

  async function changeFontSize(step) {
    const currentFontSizeText = getFontSize();
    const currentFontSize = parseFloat(currentFontSizeText);
    let newFontSize = currentFontSize + step;
    newFontSize = Math.max(newFontSize, 8);
    await setFontSize(newFontSize + 'px');
  }
  const defaultFontSizeStep = 1;

  function switchDarkTheme() {
    const currentValue = !! $storage.extensionOptions?.darkMode;
    setDarkMode(! currentValue);
  }
</script>

<main class="h-screen max-h-screen {$storage.extensionOptions?.darkMode || ($storage.extensionOptions?.darkMode && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : ''}">
  <div class="bg-zinc-50 text-black dark:bg-zinc-800 dark:text-zinc-300">
    <div class="flex flex-row justify-end pl-[8px] pr-[4px] gap-[4px] mr-[8px]">
      <div class="{iconContainerClasses}" on:click={() => changeFontSize(-defaultFontSizeStep)}>
        <i class="{iconClasses} fa-solid fa-minus"></i>
      </div>
      <div class="{iconContainerClasses}" on:click={() => changeFontSize(defaultFontSizeStep)}>
        <i class="{iconClasses} fa-solid fa-plus"></i>
      </div>
      <div class="{iconContainerClasses}" on:click={() => switchDarkTheme()}>
        <i class="{iconClasses} fa-solid fa-circle-half-stroke"></i>
      </div>
    </div>
    <TabLists />
  </div>
</main>

<style>
</style>
