<script>
  import { getStroke } from 'perfect-freehand'

  let { size = 500 } = $props()

  /** @typedef {[x: number, y: number, pressure: number]} Point */

  /** @type {SVGSVGElement} */
  let svgEl
  /** @type {Array<{ points: Array<Point> }>} */
  let strokes = $state([])

  let isDrawing = $state(false)
  let color = $state('#111111')

  // stroke options
  let options = $state({
    size: 8,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    taperStart: 0,
    taperEnd: 0,
  })

  /**
   * Convert the polygon returned by getStroke into an SVG path.
   * @param {[number, number][]} stroke Outline polygon from perfect-freehand
   * @returns {string}
   */
  function getSvgPathFromStroke(stroke) {
    if (!stroke || stroke.length === 0) return ''

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

  /**
   * Rotate a stroke around the center by a given number of degrees
  * @param {number[][]} stroke
   * @param {number} degrees
   * @param {number} [cx=size/2] Optional center x (defaults to canvas center)
   * @param {number} [cy=size/2] Optional center y (defaults to canvas center)
   * @returns {[number, number][]}
   */
  function rotateStroke(stroke, degrees, cx = size / 2, cy = size / 2) {
    const radians = (Math.PI / 180) * degrees
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    return stroke.map(([x, y]) => {
      const dx = x - cx
      const dy = y - cy
      const rx = dx * cos - dy * sin + cx
      const ry = dx * sin + dy * cos + cy
      return [rx, ry]
    })
  }

  // Derived array of path "d" values, one per stroke
  /** @type {string[]} */
  const strokePaths = $derived.by(() =>
    strokes.flatMap((s) => {
      console.log(s)
      // check the first 10 points for a pressure other than 0, .5, or 1 (common defaults)
      const hasRealPressure = s.points.slice(0, 10).some((p) => ![undefined, 0, 0.5, 1].includes(p[2]))
      const stroke = getStroke(s.points, {
        ...options,
        simulatePressure: !hasRealPressure
      })
      const angles = [0, 45, 90, 135, 180, 225, 270, 315]
      const paths = angles.map((angle) => {
        const rotatedStroke = rotateStroke(stroke, angle)
        return getSvgPathFromStroke(rotatedStroke)
      })
      return paths
    })
  )

  /**
   * Convert pointer event to local coords.
   * @param {PointerEvent} e
   * @returns {Point}
   */
  function toLocalPoint(e) {
    const r = svgEl.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const pressure = e.pressure
    return [x, y, pressure]
  }

  /** @param {PointerEvent} e */
  function handlePointerDown(e) {
    e.preventDefault()
    isDrawing = true
    try {
      svgEl.setPointerCapture(e.pointerId)
    } catch (err) {}
    // start a new stroke
    const stroke = { points: [] }
    stroke.points.push(toLocalPoint(e))
    strokes.push(stroke)
  }

  /** @param {PointerEvent} e */
  function handlePointerMove(e) {
    if (!isDrawing) return
    const stroke = strokes[strokes.length - 1]
    if (!stroke) return
    stroke.points.push(toLocalPoint(e))
  }

  /** @param {PointerEvent} e */
  function handlePointerUp(e) {
    if (!isDrawing) return
    isDrawing = false
    try {
      svgEl.releasePointerCapture(e.pointerId)
    } catch (err) {}
  }

  // helper controls
  function clear() {
    strokes.length = 0
  }

  // small convenience: export a method usable by a parent via component ref
  export function getSvgString() {
    // Build SVG containing all strokes with their original colors
    const paths = strokePaths
      .map((d) => `<path d="${d}" fill="${color}" fill-rule="nonzero"/>`)
      .join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg>`
  }
</script>

<div class="canvas-wrap">
  <div class="controls">
    <label>
      Thickness
      <input type="range" min="1" max="80" step="1" bind:value={options.size} />
    </label>

    <label>
      Expressiveness
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        bind:value={options.thinning}
        title="How much stroke width varies with pressure (0 = uniform, 1 = full variation)"
      />
    </label>

    <label>
      Color
      <input type="color" bind:value={color} />
    </label>

    <button onclick={clear}>Clear</button>
    <div style="margin-left:8px; font-size:0.9rem; color:#666;">
      Strokes: {strokes.length}
    </div>
  </div>

  <svg
    bind:this={svgEl}
    width={size}
    height={size}
    style="border:1px solid #ddd; border-radius:6px;"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    onpointerleave={handlePointerUp}
  >
    <!-- render each stroke as its own filled path -->
    {#each strokePaths as d}
      <path {d} fill={color} fill-rule="nonzero" />
    {/each}
  </svg>
</div>

<style>
  .canvas-wrap {
    display: inline-block;
  }
  .controls {
    margin-bottom: 8px;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  svg {
    background: #fff;
    display: block;
    touch-action: none;
  }
</style>
