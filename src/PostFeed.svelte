<script>
  import { onMount } from 'svelte'
  import DrawingRenderer from './DrawingRenderer.svelte'

  /** @typedef {[x: number, y: number, pressure: number]} Point */
  /** @typedef {{ id: string, strokes: { points: Point[] }[], color: string, backgroundColor: string, symmetry: number, pfp?: string | null }} Post */

  let posts = $state(/** @type {Post[]} */ ([]))
  let isLoading = $state(true)
  let error = $state(null)

  onMount(async () => {
    try {
      const res = await fetch('https://hwl.jer.app/posts')
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText)
      const data = await res.json()
      // Ensure we only keep expected shape, drop oversized arrays defensively
      posts = data.map((p) => ({ ...p }))
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading = false
    }
  })
</script>

{#if isLoading}
  <p class="status">⏳</p>
{:else if error}
  <p class="status error">⚠️</p>
{:else if !posts.length}
  <p class="status">💤</p>
{:else}
  <div class="feed" aria-live="polite">
    {#each posts as post (post.id)}
      <div class="feed-item">
        <div class="pfp-wrapper">
          <img src={post.pfp || '/pfp.png'} alt="" class="pfp" />
        </div>
        <div class="svg-wrapper" aria-label="drawing">
          <DrawingRenderer initialDrawingState={post} class="svg-inner" />
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .status {
    text-align: center;
  }
  .feed {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    justify-content: center;
  }
  .feed-item {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
    padding: 0.5rem;
    border: 1px solid #ddd;
  }
  .pfp-wrapper,
  .svg-wrapper {
    --size: clamp(140px, 30vw, 300px);
    width: var(--size);
    height: var(--size);
    display: flex;
  }
  .pfp {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .svg-inner {
    width: 100%;
    height: 100%;
  }
  .svg-inner :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
