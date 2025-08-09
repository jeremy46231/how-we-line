<script>
  /** @type {HTMLDialogElement} */
  let dialog

  /** @typedef {[x: number, y: number, pressure: number]} Point */
  /** @typedef {{ id: string, strokes: { points: Point[] }[], color: string, backgroundColor: string, symmetry: number }} DrawingState */

  /** @type {DrawingState} */
  let drawingState = $state()
  let svgRaw = $state('')
  let pfpDataUrl = $state(null) // data URL of uploaded profile picture (null = use default icon)

  let isUploading = $state(false)

  /** @type {HTMLInputElement} */
  let fileInput

  function triggerFileSelect() {
    fileInput?.click()
  }

  /**
   * Handle profile picture file selection
   * @param {Event} e
   */
  function onFileChange(e) {
    const file = /** @type {HTMLInputElement} */ (e.currentTarget).files?.[0]
    if (!file) return
    // Basic size guard (2MB)
    if (file.size > 2 * 1024 * 1024) {
      console.warn('File too large (max 2MB)')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        pfpDataUrl = reader.result
      }
    }
    reader.readAsDataURL(file)
  }

  /**
   * Open the post modal
   * @param {DrawingState} state
   * @param {string} svg
   */
  export function open(state, svg) {
    if (dialog.open) return
    drawingState = state
    svgRaw = svg
    dialog.showModal()
  }

  async function uploadDrawing() {
    try {
      isUploading = true
      // Snapshot to avoid mutation during upload
      const snapshot = $state.snapshot(drawingState)
      const payload = { ...snapshot, pfp: pfpDataUrl ?? null }
      const body = JSON.stringify(payload)
      if (body.length > 5 * 1024 * 1024) {
        return
      }
      const res = await fetch('https://hwl.jer.app/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      dialog.close()
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      isUploading = false
    }
  }
</script>

<dialog bind:this={dialog}>
  <div class="content">
    <div class="pfp-wrapper">
      <button
        type="button"
        class="pfp-button"
        onclick={triggerFileSelect}
        aria-label="profile image"
      >
        {#if pfpDataUrl}
          <img src={pfpDataUrl} alt="" class="pfp" />
        {:else}
          <img src="/pfp.png" alt="" class="pfp" />
        {/if}
      </button>
      <input
        bind:this={fileInput}
        type="file"
        accept="image/*"
        class="hidden-file"
        onchange={onFileChange}
      />
    </div>
    <div class="svg-wrapper" aria-label="drawing">
      <div class="svg-inner">{@html svgRaw}</div>
    </div>
  </div>
  <div class="actions">
    <button
      type="button"
      onclick={() => dialog.close()}
      disabled={!isUploading}
    >
      ❌
    </button>
    <button type="button" onclick={uploadDrawing} disabled={isUploading}>
      {isUploading ? '⏳' : '📤'}
    </button>
  </div>
</dialog>

<style>
  .content {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 1rem;
  }
  .pfp-wrapper,
  .svg-wrapper {
    --size: clamp(140px, 40vw, 300px);
    width: var(--size);
    height: var(--size);
    display: flex;
  }
  .pfp-button {
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
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
  }
  .hidden-file {
    display: none;
  }
</style>
