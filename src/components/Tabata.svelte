<script>
  import Button from "./Button.svelte";
  let workDuration = 20;
  let restDuration = 10;
  let rounds = 5;
  let timer = "";
  let timerTime;
  let interval;
  let currentRound = 0;
  const state = { idle: "idle", work: "work", rest: "rest", done: "done" };
  let currentState = state.idle;
  let stateColor;
  function startTimer() {
    setState(state.work, "green");
    currentRound += 1;

    timerTime = workDuration;
    timer = convertMS(timerTime);

    interval = setInterval(() => {
      timer = convertMS(timerTime - 1);
      if (timerTime === 0) {
        if (currentRound === rounds) {
          setState(state.done);
          timer = "00:00";
          console.log("done");
        } else {
          startRest(restDuration);
        }
      }
      timerTime -= 1;
    }, 1000);

    console.log("start timer" + " round " + currentRound);
  }

  function startRest(restTime) {
    setState(state.rest, "red");
    timerTime = restTime;
    timer = convertMS(timerTime);

    interval = setInterval(() => {
      timer = convertMS(timerTime - 1);
      if (timerTime === 0) {
        timerTime = workDuration;

        startTimer();
      }
      timerTime -= 1;
    }, 1000);
    console.log("start rest");
  }

  function setState(newState, color) {
    clearInterval(interval);
    currentState = newState;
    stateColor = color;
  }

  function convertMS(value) {
    const sec = value;

    let minutes = Math.floor(sec / 60);
    let seconds = sec - minutes * 60;

    if (minutes < 10) {
      minutes = "0" + minutes;
    }
    if (seconds < 10) {
      seconds = "0" + seconds;
    }
    return minutes + ":" + seconds;
  }
</script>

<nav>
  <a href="index.html">⬅️</a>
  <p>Tabata</p>
</nav>
<div class="container">
  {#if currentState === state.work || currentState === state.rest || currentState === state.done}
    <p class="info">Round {currentRound}/{rounds}</p>

    <p class="info" style="color: {stateColor};">{currentState}</p>
  {/if}

  {#if currentState === state.idle}
    <div>
      <form on:submit|preventDefault={startTimer}>
        <div class="input-1">
          <label for="rounds">
            <span class="span-left">for</span>
            <div class="input-div">
              <input name="rounds" type="number" bind:value={rounds} min="1" id="rounds" />
            </div>
            <span class="span-right">rounds</span>
          </label>
          <!-- <input type="range" bind:value={rounds} min="1" class="range" /> -->
        </div>

        <div class="input-2">
          <label for="work"
            ><span class="span-left">work</span>
            <div class="input-div">
              <input name="work" type="number" bind:value={workDuration} min="1" id="work" />
            </div>
            <span class="span-right">seconds</span>
          </label>
          <!-- <input type="range" bind:value={workDuration} min="1" class="range" /> -->
        </div>

        <div class="input-3">
          <label for="rest">
            <span class="span-left">rest</span>
            <div class="input-div">
              <input name="rest" type="number" bind:value={restDuration} min="1" id="rest" />
            </div>
            <span class="span-right">seconds</span>
          </label>
          <!-- <input type="range" bind:value={restDuration} min="1" class="range" /> -->
        </div>

        <!-- <button type="submit">start</button> -->
        <div class="input-4">
          <Button>start</Button>
        </div>
      </form>
    </div>
  {/if}
  {#if currentState === state.work || currentState === state.rest || currentState === state.done}
    <p class="timer">
      {timer}
    </p>
  {/if}
</div>

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
    font-size: 10vw;
  }

  .timer {
    font-size: 25vw;
  }
  form {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 200px 1fr;
    grid-template-rows: 50px 50px 50px 100px;
    row-gap: 50px;
  }
  .input-1 {
    grid-column: 1 / span 3;
  }
  .input-2 {
    grid-column: 1 / span 3;
  }
  .input-3 {
    grid-column: 1 / span 3;
  }
  .input-4 {
    grid-row-start: 4;
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
