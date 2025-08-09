<script>
  import { getStroke } from 'perfect-freehand'

  let { size = 600, initialDrawingState, ...restProps } = $props()

  /** @typedef {[x: number, y: number, pressure: number]} Point */
  /** @typedef {{ id: string, strokes: { points: Point[] }[], color: string, backgroundColor: string, symmetry: number, size: number, thinning: number, smoothing: number, streamline: number, taperStart: number, taperEnd: number }} DrawingState */

  /** @type {SVGSVGElement} */
  let svgEl

  /**
   * @type {DrawingState}
   */
  let drawingState = initialDrawingState

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
  let currentSymmetry = symmetrySettings[drawingState.symmetry]

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
        // @ts-ignore
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
</script>

<svg
  bind:this={svgEl}
  viewBox="0 0 {size} {size}"
  style="border:1px solid #ddd; border-radius:6px; background:{drawingState.backgroundColor};"
  onpointerover={animate}
  onclick={animate}
  {...restProps}
>
  <!-- render each stroke as its own filled path -->
  {#each strokePaths as d}
    <path {d} fill={drawingState.color} fill-rule="nonzero" />
  {/each}
</svg>
