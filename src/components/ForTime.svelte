<script>
  import Button from "./Button.svelte";
  import ConvertMS, { convertMS } from "../utils/ConvertMS.svelte";
  import { onMount } from "svelte";

  let workDuration = 10;
  let timer = "";
  let timerTime;
  let interval;
  let audio;

  const state = {
    idle: "idle",
    work: "work",
    rest: "rest",
    done: "done",
    countdown: "starting in 10s",
  };
  let currentState = state.idle;
  let stateColor;

  function tMinusTen() {
    setState(state.countdown, "yellow");
    timerTime = 10;
    timer = convertMS(timerTime);

    interval = setInterval(() => {
      timer = convertMS(timerTime - 1);
      timerTime -= 1;
      if (timerTime === 4) {
        audio.play();
      }
      if (timerTime === 0) {
        clearInterval(interval);

        startTimer();
      }
    }, 1000);
  }

  function startTimer() {
    setState(state.work, "green");
    // currentRound += 1;

    // timerTime = workDuration * 60;
    timer = convertMS(timerTime);

    interval = setInterval(() => {
      timer = convertMS(timerTime + 1);
      // console.log(timerTime);
      if (timerTime === workDuration * 60 - 5) {
        audio.play();
      }

      if (timerTime === workDuration * 60 - 1) {
        setState(state.done);
        // clearInterval(interval);
        // timer = "00:00";
        // console.log("done");
      }
      timerTime += 1;
    }, 1000);

    console.log("start timer");
  }

  function setState(newState, color) {
    clearInterval(interval);
    currentState = newState;
    stateColor = color;
  }

  onMount(() => {
    audio = document.createElement("audio");
    audio.src = "/sound/countdown.wav";
  });
</script>

<nav>
  <a href="index.html">⬅️</a>
  <p>For time</p>
</nav>
<div class="container">
  {#if currentState === state.done}
    <!-- <p class="info" style="color: {stateColor};">{currentState}</p> -->
    <p>{workDuration} minutes done</p>
  {/if}
  {#if currentState === state.idle}
    <div>
      <form on:submit|preventDefault={tMinusTen}>
        <div class="input-1">
          <label for="work"
            ><span class="span-left">work</span>
            <div class="input-div">
              <input
                name="work"
                type="number"
                bind:value={workDuration}
                min="0"
                step=".01"
                id="work"
              />
            </div>
            <span class="span-right">minutes</span>
          </label>
          <!-- <input type="range" bind:value={workDuration} min="1" class="range" /> -->
        </div>

        <div class="input-2">
          <Button>start</Button>
        </div>
      </form>
    </div>
  {/if}
</div>

<p class="timer">
  {timer}
</p>

<style>
  nav {
    display: inline-flex;
    align-items: center;
    position: absolute;
    top: 10px;
    left: 10px;
  }
  nav p {
    font-size: 2rem;
  }
  .info {
    font-size: 10vh;
  }

  .timer {
    font-size: 25vh;
  }
  form {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 200px 1fr;
    grid-template-rows: 50px 50px;
    row-gap: 50px;
  }
  .input-1 {
    grid-column: 1 / span 3;
  }
  .input-2 {
    grid-row-start: 2;
    grid-column-start: 2;
    grid-column-end: 2;
  }

  .container {
    text-align: center;
    display: flex;
    align-content: center;
    flex-direction: column;
    justify-content: center;
  }
  span {
    font-size: 3rem;
    font-weight: lighter;
  }
  .span-left {
    justify-self: end;
  }
  .span-right {
    justify-self: start;
  }

  label {
    font-size: 1.5rem;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    align-items: center;
  }

  input[type="number"] {
    background-color: hsl(0, 0%, 8%);
    color: white;
    font-size: 1.2rem;
    margin: 0px 15px;
    border-width: 2px;
    /* grid-column-start: 2; */
    height: 80px;
    width: 200px;
    font-size: 2rem;
    /* width: 100%; */
  }
</style>
