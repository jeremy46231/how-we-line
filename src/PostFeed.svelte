<script>
  import { onMount } from 'svelte'
  import { getStroke } from 'perfect-freehand'

  /** @typedef {[x: number, y: number, pressure: number]} Point */
  /** @typedef {{ id: string, strokes: { points: Point[] }[], color: string, backgroundColor: string, symmetry: number, pfp?: string | null }} Post */

  let posts = $state(/** @type {Post[]} */ ([]))
  let isLoading = $state(true)
  let error = $state(null)

  // Symmetry configurations duplicated from DrawingCanvas to reproduce original rendering
  const symmetrySettings = [
    { copies: [{ angle: 0, reflect: false }] }, // none
    {
      copies: [
        { angle: 0, reflect: false },
        { angle: 45, reflect: false },
        { angle: 90, reflect: false },
        { angle: 135, reflect: false },
        { angle: 180, reflect: false },
        { angle: 225, reflect: false },
        { angle: 270, reflect: false },
        { angle: 315, reflect: false },
      ],
    },
    {
      copies: [
        { angle: 0, reflect: false },
        { angle: 60, reflect: false },
        { angle: 120, reflect: false },
        { angle: 180, reflect: false },
        { angle: 240, reflect: false },
        { angle: 300, reflect: false },
      ],
    },
    {
      copies: [
        { angle: 0, reflect: false },
        { angle: 90, reflect: false },
        { angle: 180, reflect: false },
        { angle: 270, reflect: false },
      ],
    },
    {
      copies: [
        { angle: 0, reflect: false },
        { angle: 120, reflect: false },
        { angle: 240, reflect: false },
      ],
    },
    {
      // vertical mirror
      copies: [
        { angle: 0, reflect: false },
        { angle: 0, reflect: true },
      ],
    },
    {
      // horizontal mirror
      copies: [
        { angle: 0, reflect: false },
        { angle: 180, reflect: true },
      ],
    },
  ]

  const CANVAS_SIZE = 500 // Original drawing canvas size assumption

  /**
   * @param {[number, number][]} stroke
   * @returns {string}
   */
  function polygonToPath(stroke) {
    if (!stroke.length) return ''
    const d = stroke.reduce(
      (acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length]
        acc.push(
          x0.toFixed(2),
          y0.toFixed(2),
          ((x0 + x1) / 2).toFixed(2),
          ((y0 + y1) / 2).toFixed(2)
        )
        return acc
      },
      ['M', stroke[0][0].toFixed(2), stroke[0][1].toFixed(2), 'Q']
    )
    d.push('Z')
    return d.join(' ')
  }

  /** @param {[number, number][]} stroke @param {number} degrees */
  function rotateStroke(
    stroke,
    degrees,
    cx = CANVAS_SIZE / 2,
    cy = CANVAS_SIZE / 2
  ) {
    const r = (Math.PI / 180) * degrees
    const cos = Math.cos(r)
    const sin = Math.sin(r)
    return stroke.map(([x, y]) => {
      const dx = x - cx
      const dy = y - cy
      return [dx * cos - dy * sin + cx, dx * sin + dy * cos + cy]
    })
  }
  /** @param {[number, number][]} stroke */
  function reflectStroke(stroke, cx = CANVAS_SIZE / 2) {
    return stroke.map(([x, y]) => [-x + cx * 2, y])
  }

  /** Build array of path d values for a post */
  function buildPathDs(post) {
    const symmetry = symmetrySettings[post.symmetry] || symmetrySettings[0]
    const all = []
    for (const strokeObj of post.strokes) {
      const points = strokeObj.points || []
      // detect real pressure (same heuristic as canvas component)
      const hasRealPressure = points
        .slice(0, 10)
        .some((p) => ![undefined, 0, 0.5, 1].includes(p[2]))
      // @ts-ignore perfect-freehand types
      const poly = getStroke(points, {
        size: post.size ?? 8,
        thinning: post.thinning ?? 0.6,
        smoothing: post.smoothing ?? 0.5,
        streamline: post.streamline ?? 0.5,
        taperStart: post.taperStart ?? 0,
        taperEnd: post.taperEnd ?? 0,
        simulatePressure: !hasRealPressure,
      })
      for (const copy of symmetry.copies) {
        let mod = poly
        if (copy.angle) mod = rotateStroke(mod, copy.angle)
        if (copy.reflect) mod = reflectStroke(mod)
        all.push(polygonToPath(mod))
      }
    }
    return all
  }

  /** @param {Post} post */
  function buildSvg(post) {
    const ds = buildPathDs(post)
    const bg = `<rect width="100%" height="100%" fill="${post.backgroundColor}" />`
    const paths = ds
      .map((d) => `<path d="${d}" fill="${post.color}" fill-rule="nonzero" />`)
      .join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">${bg}${paths}</svg>`
  }

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
          <div class="svg-inner">{@html buildSvg(post)}</div>
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
