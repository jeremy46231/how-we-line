<script>
  import { getStroke } from 'perfect-freehand'
  import { onMount } from 'svelte'
  import { nanoid } from 'nanoid'
  import PostDialog from './PostDialog.svelte'
  import DrawingRenderer from './DrawingRenderer.svelte'

  let { size = 600, initialDrawingState = undefined } = $props()

  /** @typedef {[x: number, y: number, pressure: number]} Point */
  /** @typedef {{ id: string, strokes: { points: Point[] }[], color: string, backgroundColor: string, symmetry: number, size: number, thinning: number, smoothing: number, streamline: number, taperStart: number, taperEnd: number }} DrawingState */

  /** @type {SVGSVGElement} */
  let svgEl
  /** @type {PostDialog} */
  let postDialog

  /**
   * @type {DrawingState}
   */
  let drawingState = $state(
    initialDrawingState ?? {
      id: nanoid(),
      strokes: [],
      color: '#111111',
      backgroundColor: '#ffffff',
      symmetry: 1,
      size: 8,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      taperStart: 0,
      taperEnd: 0,
    }
  )

  let isDrawing = $state(false)
  let isUploading = $state(false)
  let uploadingStatus = $state('📤')
  let rerenderPastDrawings = $state(false)

  const symmetrySettings = [
    {
      // no symmetry
      copies: [{ angle: 0, reflect: false }],
    },
    {
      // 8-way symmetry
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
      // 6-way symmetry
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
      // 4-way symmetry
      copies: [
        { angle: 0, reflect: false },
        { angle: 90, reflect: false },
        { angle: 180, reflect: false },
        { angle: 270, reflect: false },
      ],
    },
    {
      // 3-way symmetry
      copies: [
        { angle: 0, reflect: false },
        { angle: 120, reflect: false },
        { angle: 240, reflect: false },
      ],
    },
    {
      // 2-way symmetry over the vertical axis
      copies: [
        { angle: 0, reflect: false },
        { angle: 0, reflect: true },
      ],
    },
    {
      // 2-way symmetry over the horizontal axis
      copies: [
        { angle: 0, reflect: false },
        { angle: 180, reflect: true },
      ],
    },
  ]
  let currentSymmetry = $derived.by(
    () => symmetrySettings[drawingState.symmetry]
  )
  function incrementSymmetry() {
    drawingState.symmetry++
    drawingState.symmetry %= symmetrySettings.length
  }

  // Usually the same thing as strokes, but when animating, changes to that
  let isAnimating = $state(false)
  /** @type {{ points: Point[] }[]} */
  let animationStrokes = $state([])
  let renderedStrokes = $derived.by(() => {
    if (isAnimating) {
      return animationStrokes
    }
    return drawingState.strokes
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
   * @param {[number, number][]} stroke
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
  /**
   * Reflect a stroke across the vertical axis through the center.
   * @param {[number, number][]} stroke
   * @param {number} [cx=size/2] Optional center x (defaults to canvas center)
   * @param {number} [cy=size/2] Optional center y (defaults to canvas center)
   * @returns {[number, number][]}
   */
  function reflectStroke(stroke, cx = size / 2, cy = size / 2) {
    return stroke.map(([x, y]) => [-x + cx * 2, y])
  }

  // Derived array of path "d" values, one per stroke
  /** @type {string[]} */
  const strokePaths = $derived.by(() =>
    renderedStrokes.flatMap((s) => {
      // check the first 10 points for a pressure other than 0, .5, or 1 (common defaults)
      const hasRealPressure = s.points
        .slice(0, 10)
        .some((p) => ![undefined, 0, 0.5, 1].includes(p[2]))
      /** @type {[number, number][]} */
      // @ts-ignore
      const stroke = getStroke(s.points, {
        size: drawingState.size,
        thinning: drawingState.thinning,
        smoothing: drawingState.smoothing,
        streamline: drawingState.streamline,
        taperStart: drawingState.taperStart,
        taperEnd: drawingState.taperEnd,
        simulatePressure: !hasRealPressure,
      })

      const paths = currentSymmetry.copies.map((copy) => {
        let modifiedStroke = stroke
        if (copy.angle !== 0) {
          modifiedStroke = rotateStroke(modifiedStroke, copy.angle)
        }
        if (copy.reflect) {
          modifiedStroke = reflectStroke(modifiedStroke)
        }
        return getSvgPathFromStroke(modifiedStroke)
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
    drawingState.strokes.push(stroke)
  }

  /** @param {PointerEvent} e */
  function handlePointerMove(e) {
    if (isAnimating) return
    if (!isDrawing) return
    const stroke = drawingState.strokes[drawingState.strokes.length - 1]
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

      // auto save the current drawing to localStorage
      if (localStorage.getItem('savedDrawings')) {
        const currentlySavedDrawings = JSON.parse(
          localStorage.getItem('savedDrawings')
        )

        const mostRecentDrawingId = currentlySavedDrawings.reverse()[0].id

        if (drawingState.id === mostRecentDrawingId)
          currentlySavedDrawings.pop()
        // efficient snapshot of current drawing state
        const snapshot = $state.snapshot(drawingState)
        localStorage.setItem(
          'savedDrawings',
          JSON.stringify([...currentlySavedDrawings, snapshot].slice(-6))
        )
      } else {
        const snapshot = $state.snapshot(drawingState)
        localStorage.setItem('savedDrawings', JSON.stringify([snapshot]))
      }
      // change the value of rerenderpastdrawings so that the {#key} block causes it to re-render
      rerenderPastDrawings = !rerenderPastDrawings
    } catch (err) {}
  }

  // helper controls
  function clear() {
    if (isAnimating) return
    drawingState.strokes.length = 0
    drawingState.id = nanoid()
  }
  function undo() {
    if (isAnimating) return
    drawingState.strokes.pop()
  }
  function clearPastDrawings() {
    localStorage.removeItem('savedDrawings')
    rerenderPastDrawings = !rerenderPastDrawings
  }
  function openPostDialog() {
    const svgString = getSvgString()
    postDialog.open(drawingState, svgString)
  }

  // Keyboard shortcuts (Ctrl/Cmd + Z for undo)
  onMount(() => {
    function handleKeydown(e) {
      // Ignore if focused element is an input to avoid interfering with native editing
      const ae = document.activeElement
      if (ae && ae.tagName === 'INPUT') return
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === 'z'
      ) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  })

  /** @param {number} ms */
  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
  async function animate() {
    if (isAnimating) return
    isAnimating = true
    animationStrokes.length = 0
    // @ts-ignore
    animationStrokes = $state.snapshot(drawingState.strokes)
    while (animationStrokes.length > 0) {
      const stroke = animationStrokes[0]
      while (stroke.points.length > 0) {
        stroke.points.shift()
        await sleep(4)
      }
      animationStrokes.shift()
    }
    animationStrokes.length = 0
    await sleep(250)
    for (const stroke of drawingState.strokes) {
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
      await sleep(100)
    }
    isAnimating = false
  }

  export function getSvgString() {
    // Build SVG containing all strokes with their original colors
    const paths = strokePaths
      .map(
        (d) =>
          `<path d="${d}" fill="${drawingState.color}" fill-rule="nonzero"/>`
      )
      .join('')
    const bg = `<rect width="100%" height="100%" fill="${drawingState.backgroundColor}" />`
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}${paths}</svg>`
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

<div class="canvas-wrapper">
  <div class="drawing-canvas">
    <svg
      class="drawing-canvas-svg"
      bind:this={svgEl}
      viewBox="0 0 {size} {size}"
      style="border:1px solid #ddd; border-radius:6px; background:{drawingState.backgroundColor};"
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerUp}
      onpointerleave={handlePointerUp}
    >
      <!-- render each stroke as its own filled path -->
      {#each strokePaths as d}
        <path {d} fill={drawingState.color} fill-rule="nonzero" />
      {/each}
    </svg>

    <div class="controls">
      <input
        type="range"
        min="1"
        max="30"
        step="1"
        bind:value={drawingState.size}
        disabled={isAnimating}
      />
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        bind:value={drawingState.thinning}
        disabled={isAnimating}
      />

      <div class="controls-buttons">
        <input
          type="color"
          bind:value={drawingState.color}
          disabled={isAnimating}
        />
        <input
          type="color"
          bind:value={drawingState.backgroundColor}
          disabled={isAnimating}
          title="Background color"
        />
        <button onclick={incrementSymmetry} disabled={isAnimating}>🪞</button>
        <button onclick={animate} disabled={isAnimating}>▶️</button>
        <span style="width: 1rem;"></span>
        <button onclick={undo} disabled={isAnimating}>↩️</button>
        <button onclick={downloadSvg} disabled={isAnimating}>💾</button>
        <button onclick={clear} disabled={isAnimating}>🚫</button>
        <button onclick={clearPastDrawings} disabled={isAnimating}>❌</button>
        <button onclick={openPostDialog}>📤</button>
      </div>
    </div>
  </div>

  {#key rerenderPastDrawings}
    <div id="pastDrawings">
      {#if localStorage.getItem('savedDrawings')}
        {#each JSON.parse(localStorage.getItem('savedDrawings')).reverse() as drawing}
          <DrawingRenderer
            initialDrawingState={drawing}
            class="past-svg"
            width="100"
            height="100"
          />
        {/each}
      {/if}
    </div>
  {/key}
</div>

<PostDialog bind:this={postDialog} />

<style>
  .canvas-wrapper {
    display: flex;
    align-items: flex-start;
    gap: 16px;
  }
  .drawing-canvas {
    width: 600px;
    max-width: 100%;
    flex: 0 0 auto;
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

  .past-svg {
    width: 100px;
    height: 100px;
    text-align: left;
  }

  #pastDrawings {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 0 0 auto;
  }

  @media screen and (max-width: 900px) {
    .canvas-wrapper {
      flex-direction: column;
    }
    #pastDrawings {
      display: none;
    }
  }
</style>
