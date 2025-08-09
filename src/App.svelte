<svelte:head><title>How We Line</title></svelte:head>

<script>
  import DrawingCanvas from './DrawingCanvas.svelte';
  import SoundGenerator from './SoundGenerator.svelte';
</script>

<DrawingCanvas size={600} />
<SoundGenerator />

<style>
  :global(body){
    margin:0;
    background:#fafafa; /* light background */
    font-family: system-ui, sans-serif;
  }
</style>
