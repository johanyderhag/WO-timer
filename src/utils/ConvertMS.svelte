<script context="module">
  export function convertMS(value) {
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
