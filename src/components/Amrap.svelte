<script>
  import Button from "./Button.svelte";

  let inputMinutes = 1;
  let timer = "";
  let tMinusAmrap;

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

  const handleSubmit = () => {
    let tMinus = 10;
    timer = convertMS(tMinus);
    let startCDId = setInterval(() => {
      timer = convertMS(tMinus - 1);
      tMinus--;
      if (tMinus === 0) {
        clearInterval(startCDId);
        tMinusAmrap = inputMinutes * 60;
        timer = convertMS(tMinusAmrap);
        let amrapCDId = setInterval(() => {
          timer = convertMS(tMinusAmrap - 1);
          tMinusAmrap--;
          if (tMinusAmrap === 0) {
            clearInterval(amrapCDId);
          }
        }, 1000);
      }
    }, 1000);
  };
</script>

<nav>
  <a href="index.html">⬅️</a>
  <p>Amrap</p>
</nav>
<div class="container">
  <form on:submit|preventDefault={handleSubmit}>
    <label for="">for <input type="number" bind:value={inputMinutes} min="1" /> min</label>
    <input type="range" bind:value={inputMinutes} min="1" class="range" />

    <Button type="submit">start</Button>
  </form>
  <h1>{timer}</h1>
</div>

<style>
  h1 {
    font-size: 25vh;
  }
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
  form {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;

    /* width: 200px; */
    margin: auto;
  }
  .container {
    text-align: center;
    display: flex;
    align-content: center;
    flex-direction: column;
    /* width: 300px; */
    display: flex;
  }
  label {
    display: flex;
    /* align-items: center; */
    gap: 10px;
    font-size: 1.5rem;
  }
  input {
    height: 30px;
    width: 80px;
    font-size: 1.2rem;
  }
  .range {
    width: 160px;
  }

  /* p {
    font-size: 100px;
    margin: 0;
  } */
</style>
