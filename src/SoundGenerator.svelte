<script>
  import { onDestroy } from 'svelte'
  let unsub
  let sharedColor = '#000'
  unsub = activeColor.subscribe((c) => (sharedColor = c))
  onDestroy(() => unsub && unsub())

  let audioCtx
  let isPlaying = false

  // Three emotion voices (happy, sad, mad)
  const voices = [
    {
      key: 'happy',
      color: '#f5d400',
      wave: 'triangle',
      range: [400, 1000],
      freq: 680,
      vol: 0.85,
      osc: null,
      gain: null,
    },
    {
      key: 'sad',
      color: '#3a7bd5',
      wave: 'sine',
      range: [120, 500],
      freq: 310,
      vol: 0.75,
      osc: null,
      gain: null,
    },
    {
      key: 'mad',
      color: '#e03131',
      wave: 'sawtooth',
      range: [200, 800],
      freq: 500,
      vol: 0.9,
      osc: null,
      gain: null,
    },
  ]

  // (Removed animated chord lines; simpler mechanical wheel look.)

  let masterGain

  // Create / resume audio context (handle older webkit prefix safely)
  function ensureCtx() {
    if (!audioCtx) {
      // Fallback for older Safari (ignore TS complaint in JS file)
      const Ctx =
        window.AudioContext ||
        (window['webkitAudioContext'] && window['webkitAudioContext'])
      audioCtx = new Ctx()
      masterGain = audioCtx.createGain()
      masterGain.gain.value = 0.18 // gentle
      masterGain.connect(audioCtx.destination)
    }
  }

  function startAll() {
    ensureCtx()
    voices.forEach((v) => {
      if (v.osc) return // already running
      const o = audioCtx.createOscillator()
      o.type = v.wave
      o.frequency.value = v.freq
      const g = audioCtx.createGain()
      g.gain.value = (v.vol ?? 1) / voices.length
      o.connect(g).connect(masterGain)
      o.start()
      v.osc = o
      v.gain = g
    })
    isPlaying = true
  }

  function stopAll() {
    voices.forEach((v) => {
      if (v.osc) {
        try {
          v.osc.stop()
        } catch {}
        v.osc.disconnect()
        v.osc = null
      }
    })
    isPlaying = false
  }

  function togglePlay() {
    isPlaying ? stopAll() : startAll()
  }

  function setVoiceFreq(index, voiceValue) {
    const v = voices[index]
    v.freq = voiceValue
    if (v.osc)
      v.osc.frequency.setTargetAtTime(voiceValue, audioCtx.currentTime, 0.015)
  }

  function setVoiceVol(index, voiceValue) {
    const v = voices[index]
    v.vol = voiceValue
    if (v.gain)
      v.gain.gain.setTargetAtTime(
        voiceValue / voices.length,
        audioCtx.currentTime,
        0.02
      )
  }
</script>

<!-- Right sidebar with stacked themed wheels -->
<div class="bar" aria-label="emotion control panel">
  {#each voices as v, i}
    <div
      class="wheel"
      on:pointerdown={() => {
        if (!isPlaying) togglePlay()
      }}
    >
      <input
        type="range"
        min={v.range[0]}
        max={v.range[1]}
        value={v.freq}
        on:input={(event) => setVoiceFreq(i, event.target.value)}
      />
    </div>
  {/each}
</div>

<style>
  .bar {
    display: flex;
    gap: 8px;
    width: 100%;
    flex-wrap: wrap;
    box-sizing: border-box;
  }

  .bar input[type=range] {
    flex: 1 1 60px;
  }

  .wheel {
    flex: 0 0 min-content;
    display: flex;
    gap: 4px;
  }
</style>
