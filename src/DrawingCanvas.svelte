<script>
  import { getStroke } from 'perfect-freehand'

  let { size = 500 } = $props()

  /** @typedef {[x: number, y: number, pressure: number]} Point */

  /** @type {SVGSVGElement} */
  let svgEl
  /** @type {{ points: Point[] }[]} */
  let strokes = $state([])

  let isDrawing = $state(false)
  let color = $state('#111111')

  // Usually the same thing as strokes, but when animating, changes to that
  let isAnimating = $state(false)
  /** @type {{ points: Point[] }[]} */
  let animationStrokes = $state([])
  let renderedStrokes = $derived.by(() => {
    if (isAnimating) {
      return animationStrokes
    }
    return strokes
  })

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
    renderedStrokes.flatMap((s) => {
      // check the first 10 points for a pressure other than 0, .5, or 1 (common defaults)
      const hasRealPressure = s.points
        .slice(0, 10)
        .some((p) => ![undefined, 0, 0.5, 1].includes(p[2]))
      const stroke = getStroke(s.points, {
        ...options,
        simulatePressure: !hasRealPressure,
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
    if (isAnimating) return
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
    if (isAnimating) return
    if (!isDrawing) return
    const stroke = strokes[strokes.length - 1]
    if (!stroke) return
    stroke.points.push(toLocalPoint(e))
  }

  /** @param {PointerEvent} e */
  function handlePointerUp(e) {
    if (isAnimating) return
    if (!isDrawing) return
    isDrawing = false
    try {
      svgEl.releasePointerCapture(e.pointerId)
    } catch (err) {}
  }

  // helper controls
  function clear() {
    if (isAnimating) return
    strokes.length = 0
  }
  function undo() {
    if (isAnimating) return
    strokes.pop()
  }

  /** @param {number} ms */
  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
  async function animate() {
    if (isAnimating) return
    console.log('Animating...')
    isAnimating = true
    animationStrokes.length = 0
    for (const stroke of strokes) {
      console.log('stroke')
      animationStrokes.push({ points: [] })
      for (const point of stroke.points) {
        const [x, y, pressure] = point
        animationStrokes[animationStrokes.length - 1].points.push([
          x,
          y,
          pressure,
        ])
        await sleep(15)
      }
      await sleep(250)
    }
    isAnimating = false
    console.log('Animation complete')
  }
  // small convenience: export a method usable by a parent via component ref
  export function getSvgString() {
    // Build SVG containing all strokes with their original colors
    const paths = strokePaths
      .map((d) => `<path d="${d}" fill="${color}" fill-rule="nonzero"/>`)
      .join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg>`
  }
  function downloadSvg() {
    const svgString = getSvgString()
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = 'how-we-line.svg'
    a.click()

    URL.revokeObjectURL(url)
  }
</script>

<div class="drawing-canvas">
  <svg
    class="drawing-canvas-svg"
    bind:this={svgEl}
    viewBox="0 0 {size} {size}"
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

  <div class="controls">
    <input type="range" min="1" max="80" step="1" bind:value={options.size} />
    <input
      type="range"
      min="0"
      max="1"
      step="0.05"
      bind:value={options.thinning}
    />
    
    <div class="controls-buttons">
      <input type="color" bind:value={color} />
      <button onclick={clear}>🚫</button>
      <button onclick={undo}>↩️</button>
      <button onclick={animate}>▶️</button>
      <button onclick={downloadSvg}>💾</button>
    </div>
  </div>
</div>

<style>
  .drawing-canvas {
    width: 100%;
    max-width: 600px;
    display: inline-block;
  }
  .drawing-canvas-svg {
    width: 100%;
  }
  .controls {
    display: flex;
    gap: 8px;
    width: 100%;
    flex-wrap: wrap;
    box-sizing: border-box;
  }
  .controls input[type='range'] {
    flex: 1 1 60px;
  }
  .controls-buttons {
    flex: 0 0 min-content;
    display: flex;
    gap: 4px;
  }
  svg {
    background: #fff;
    display: block;
    touch-action: none;
  }
</style>
