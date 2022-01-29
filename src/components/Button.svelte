<button on:click> <slot /> </button>

<style>
  button {
    border: 2px solid #fff;
    border-radius: 8px;
    color: rgb(255, 255, 255);
    width: 100%;
    /* height: 100px; */
    cursor: pointer;
    background-color: hsl(0, 0%, 8%);
    text-transform: uppercase;
    font-size: 50px;
    /* font-weight: 700; */
    /* margin: 25px; */
  }

  button:hover {
    transform: scale(0.98);
    opacity: 0.9;
    background-color: white;
    color: hsl(0, 0%, 8%);
  }
</style>
