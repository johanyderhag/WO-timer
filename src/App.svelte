<script>
  import Button from "./components/Button.svelte";
  import Clock from "./components/Clock.svelte";
  import Tabata from "./components/Tabata.svelte";
  import ForTime from "./components/ForTime.svelte";
  import Emom from "./components/Emom.svelte";
  import Amrap from "./components/Amrap.svelte";

  let showButtons = true;

  let showClock = false;
  let showTabata = false;
  let showForTime = false;
  let showEmom = false;
  let showAmrap = false;
</script>

<main>
  <div class="container">
    <div class="items">
      {#if showButtons}
        <Button on:click={() => ((showClock = true), (showButtons = false))}>clock</Button>
        <Button on:click={() => ((showTabata = true), (showButtons = false))}>tabata</Button>
        <Button on:click={() => ((showForTime = true), (showButtons = false))}>for time</Button>
        <Button on:click={() => ((showEmom = true), (showButtons = false))}>emom</Button>
        <Button on:click={() => ((showAmrap = true), (showButtons = false))}>amrap</Button>
      {/if}

      {#if showClock}
        <Clock />
      {/if}
      {#if showTabata}
        <Tabata />
      {/if}
      {#if showForTime}
        <ForTime />
      {/if}
      {#if showEmom}
        <Emom />
      {/if}
      {#if showAmrap}
        <Amrap />
      {/if}
    </div>
  </div>
  <p>made by: johan yderhag</p>
</main>

<style>
  .container {
    display: flex;
    justify-content: center;
  }
  .items {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100vh;
  }
  p {
    font-size: 1rem;
    font-weight: 100;
  }

  /* @media (min-width: 640px) {
    main {
      max-width: none;
    }
  } */
</style>
