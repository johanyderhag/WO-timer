<script>
  let clock = new Date().toLocaleTimeString("sv-SE");
  setInterval(() => {
    clock = new Date().toLocaleTimeString("sv-SE");
  }, 1000);
</script>

<nav>
  <a href="index.html">⬅️</a>
  <p>Clock</p>
</nav>
<h1>
  {clock}
</h1>

<style>
  h1 {
    font-size: 25vw;
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
</style>
