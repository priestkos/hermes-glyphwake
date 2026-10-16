/**
 * Glyphwake — click the blank new-chat canvas and a wave of scrambling
 * characters rolls out from the pointer. Where it passes, the noise decodes
 * into an ASCII wordmark (NOUS RESEARCH / HERMES AGENT) set in the app's own
 * Collapse face, holds for a beat, then dissolves back into nothing.
 *
 * There is no SDK slot behind the empty chat, so the canvas goes into the
 * chat surface (`composer-bounds`), and "empty" means the thread has no
 * message groups yet, with the intro splash on or off. Those `data-slot`
 * names are app DOM, not SDK API: if a Desktop update renames them the
 * plugin goes quiet rather than breaking anything.
 */

import { atom, ListRow, SegmentedControl, useValue } from '@hermes/plugin-sdk'
import { jsx } from 'react/jsx-runtime'

const BOUNDS = '[data-slot="composer-bounds"]'
const THREAD = '[data-slot="thread"]'
const MESSAGE = '[data-slot="aui_message-group"]'
const INTRO = '[data-slot="aui_intro"]'
const LAYER_ATTR = 'data-glyphwake'

// Clicks on anything you can interact with stay ordinary clicks.
const INTERACTIVE = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  '[contenteditable]',
  '[role="button"]',
  '[role="menu"]',
  '[role="dialog"]',
  '[role="textbox"]',
  '[data-slot="composer-root"]'
].join(',')

const WORDMARKS = {
  nous: ['NOUS', 'RESEARCH'],
  hermes: ['HERMES', 'AGENT']
}

const MODES = [
  { id: 'alternate', label: 'Alternate' },
  { id: 'nous', label: 'Nous Research' },
  { id: 'hermes', label: 'Hermes Agent' },
  { id: 'off', label: 'Noise only' }
]

const NOISE = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
// Lightest to densest: anti-aliases the letter edges.
const EDGE = '.:-=+'
// Coverage above which a cell is letter interior rather than edge.
const SOLID = 0.45
const WORDMARK_FONT = '"Collapse", "Segoe UI", system-ui, sans-serif'
const CELL_FONT_PX = 12
const LINE_PX = 14
const WAVE_MS = 2600
const HOLD_MS = 900
const FADE_MS = 1300
const LIFE_MS = WAVE_MS + HOLD_MS + FADE_MS
const MAX_RIPPLES = 4

const easeOut = t => 1 - (1 - t) ** 3
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function hash(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)

  return (h ^ (h >>> 16)) >>> 0
}

// Resolve a theme variable to a concrete color the canvas accepts, so the
// effect follows light/dark and custom themes without hardcoding anything.
function themeColor(el, cssVar, fallbackVar) {
  const probe = document.createElement('span')
  probe.style.color = `var(${cssVar}, var(${fallbackVar}))`
  probe.style.display = 'none'
  el.appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()

  return color
}

/** Largest font size at which `lines` fit a `maxW` × `maxH` box. */
function fitFont(g, lines, maxW, maxH) {
  g.font = `700 100px ${WORDMARK_FONT}`
  const widest = Math.max(...lines.map(line => g.measureText(line).width))
  // Collapse sets at line-height 0.9 in the app; match it.
  const byWidth = (100 * maxW) / widest
  const byHeight = maxH / (lines.length * 0.9)

  return Math.min(byWidth, byHeight)
}

/**
 * Rasterise the wordmark at full resolution, then let the browser box-filter
 * it down to one pixel per character cell: each cell's alpha is its ink
 * coverage. Positioned around the click, clamped to stay on the surface and
 * clear of the composer.
 */
function buildMark(surface, word, x, y) {
  const { cols, rows, cellW, width, height, reserveBottom } = surface
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const g = canvas.getContext('2d')
  g.letterSpacing = '0.08em'

  const usableH = Math.max(LINE_PX * 6, height - reserveBottom)
  // Stacked reads larger than one long line; take whichever layout wins.
  const stacked = word
  const single = [word.join(' ')]
  // As big as the surface allows: Collapse has hairline strokes, and a stroke
  // under ~3 cells thick reads as noise rather than a letter.
  const box = [width * 0.92, usableH * 0.82]
  const lines = fitFont(g, stacked, ...box) >= fitFont(g, single, ...box) ? stacked : single
  const size = Math.max(LINE_PX * 4, fitFont(g, lines, ...box))
  const lineH = size * 0.9
  const blockH = lineH * lines.length
  g.font = `700 ${size}px ${WORDMARK_FONT}`
  const blockW = Math.max(...lines.map(line => g.measureText(line).width))

  const cx = clamp(x, blockW / 2 + 12, Math.max(blockW / 2 + 12, width - blockW / 2 - 12))
  const cy = clamp(y, blockH / 2 + 12, Math.max(blockH / 2 + 12, usableH - blockH / 2 - 12))

  g.fillStyle = '#fff' // mask only: never painted, just read back as coverage
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  lines.forEach((line, i) => g.fillText(line, cx, cy - blockH / 2 + lineH * (i + 0.5)))

  const cells = document.createElement('canvas')
  cells.width = cols
  cells.height = rows
  const cg = cells.getContext('2d', { willReadFrequently: true })
  cg.imageSmoothingQuality = 'high'
  cg.drawImage(canvas, 0, 0, cols * cellW, rows * LINE_PX, 0, 0, cols, rows)
  const pixels = cg.getImageData(0, 0, cols, rows).data
  const coverage = new Float32Array(cols * rows)

  for (let i = 0; i < coverage.length; i++) {
    coverage[i] = pixels[i * 4 + 3] / 255
  }

  return { coverage, cols, letters: word.join('') }
}

function makeRipple(x, y, reach, mark) {
  // A few low harmonics around the circle give the blobby, organic edge.
  const waves = [2, 3, 5, 7].map(k => ({
    k,
    amp: (0.18 / k) * (0.6 + Math.random() * 0.8),
    phase: Math.random() * Math.PI * 2,
    drift: (Math.random() - 0.5) * 1.6
  }))

  return { x, y, reach, waves, mark, seed: (Math.random() * 1e6) | 0, born: performance.now() }
}

/** Where the wave front is at angle `angle`, `age` 0..1 into the wave. */
function frontRadius(ripple, angle, age) {
  let n = 1

  for (const w of ripple.waves) {
    n += w.amp * Math.sin(w.k * angle + w.phase + w.drift * age * 3)
  }

  return easeOut(age) * ripple.reach * n
}

/**
 * One ripple at one cell → { wave, mark, settled }.
 * wave: the moving front plus its thinning wake. mark: how strongly the
 * wordmark shows here. settled: whether the front has passed far enough for
 * the cell to have decoded into its letter.
 */
function sample(ripple, col, row, cx, cy, now, out) {
  const t = now - ripple.born
  const age = Math.min(1, t / WAVE_MS)
  const dx = cx - ripple.x
  const dy = (cy - ripple.y) * 1.15
  const dist = Math.hypot(dx, dy)
  const radius = frontRadius(ripple, Math.atan2(dy, dx), age)
  const behind = radius - dist

  out.wave = 0
  out.mark = 0
  out.settled = false

  if (t < WAVE_MS) {
    const band = 26 + 70 * age
    const front = Math.exp(-((behind / band) ** 2) * 2.2)
    const wake = behind > 0 ? Math.exp(-behind / (radius * 0.45 + 1)) * 0.35 : 0
    out.wave = Math.min(1, (front + wake) * (1 - age ** 2))
  }

  const mark = ripple.mark

  if (mark && behind > 0) {
    const cover = mark.coverage[row * mark.cols + col]

    if (cover > 0.12) {
      // Fade in as the front clears the cell, then dissolve grain by grain.
      const reveal = clamp(behind / 60, 0, 1)
      const fade = 1 - clamp((t - WAVE_MS - HOLD_MS) / FADE_MS, 0, 1)
      const grain = (hash(col, row, ripple.seed) % 1000) / 1000
      out.mark = grain < fade ? cover * reveal * (0.35 + 0.65 * fade) : 0
      out.settled = behind > 90 && grain < fade * 0.85
    }
  }
}

class RippleLayer {
  constructor(bounds) {
    this.bounds = bounds
    this.ripples = []
    this.frame = 0
    this.probe = { wave: 0, mark: 0, settled: false }
    this.canvas = document.createElement('canvas')
    this.canvas.setAttribute(LAYER_ATTR, '')
    this.canvas.setAttribute('aria-hidden', 'true')
    // First child + positioned: the (also positioned) thread paints over it,
    // so the intro text stays on top of the characters.
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none'
    })
    bounds.prepend(this.canvas)
    this.g = this.canvas.getContext('2d')
    this.resizer = new ResizeObserver(() => this.resize())
    this.resizer.observe(bounds)
    this.resize()
  }

  resize() {
    const dpr = window.devicePixelRatio || 1
    const { width, height } = this.bounds.getBoundingClientRect()
    this.width = width
    this.height = height
    this.canvas.width = Math.max(1, Math.round(width * dpr))
    this.canvas.height = Math.max(1, Math.round(height * dpr))
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.g.font = `${CELL_FONT_PX}px ui-monospace, "JetBrains Mono", "Cascadia Mono", Consolas, monospace`
    this.g.textBaseline = 'top'
    this.cellW = Math.max(5, this.g.measureText('M').width)
    this.cols = Math.ceil(width / this.cellW)
    this.rows = Math.ceil(height / LINE_PX)
    const composer = parseFloat(getComputedStyle(this.bounds).getPropertyValue('--composer-measured-height'))
    this.reserveBottom = Number.isFinite(composer) ? composer + 24 : 140
    this.colors = {
      mark: themeColor(this.bounds, '--ui-text-primary', '--ui-text-secondary'),
      front: themeColor(this.bounds, '--ui-accent', '--ui-text-primary'),
      wake: themeColor(this.bounds, '--ui-text-tertiary', '--ui-text-secondary')
    }
  }

  spawn(clientX, clientY, word) {
    if (this.cols < 1 || this.rows < 1) {
      return
    }

    const rect = this.bounds.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    // Reach the farthest corner so the wave washes the whole surface.
    const reach =
      Math.max(
        Math.hypot(x, y),
        Math.hypot(rect.width - x, y),
        Math.hypot(x, rect.height - y),
        Math.hypot(rect.width - x, rect.height - y)
      ) * 0.9

    this.ripples.push(makeRipple(x, y, reach, word ? buildMark(this, word, x, y) : null))

    if (this.ripples.length > MAX_RIPPLES) {
      this.ripples.shift()
    }

    if (!this.frame) {
      this.frame = requestAnimationFrame(this.tick)
    }
  }

  tick = now => {
    this.ripples = this.ripples.filter(r => now - r.born < LIFE_MS)
    this.dimIntro(this.ripples.some(r => r.mark && now - r.born < WAVE_MS + HOLD_MS))
    this.draw(now)
    this.frame = this.ripples.length ? requestAnimationFrame(this.tick) : 0
  }

  /** The splash's own lettering sits on top of the canvas and would hide the
   *  wordmark, so it steps back while one is on screen and returns as the
   *  wordmark dissolves. Inline styles only, restored exactly. */
  dimIntro(on) {
    const intro = this.bounds.querySelector(INTRO)

    if (on && intro && !this.dimmed) {
      this.dimmed = { el: intro, opacity: intro.style.opacity, transition: intro.style.transition }
      intro.style.transition = 'opacity 280ms ease-out'
      intro.style.opacity = '0.06'
    } else if (!on && this.dimmed) {
      const { el, opacity, transition } = this.dimmed
      this.dimmed = null
      el.style.transition = `opacity ${FADE_MS}ms ease-in-out`
      el.style.opacity = opacity
      setTimeout(() => {
        if (!this.dimmed) {
          el.style.transition = transition
        }
      }, FADE_MS)
    }
  }

  draw(now) {
    const { g, cellW, cols, rows, width, height, ripples, colors, probe } = this
    g.clearRect(0, 0, width, height)

    if (!ripples.length) {
      return
    }

    const fast = Math.floor(now / 55)
    const slow = Math.floor(now / 420)

    for (let row = 0; row < rows; row++) {
      const cy = row * LINE_PX + LINE_PX / 2

      for (let col = 0; col < cols; col++) {
        const cx = col * cellW + cellW / 2
        let wave = 0
        let mark = 0
        let settled = false
        let letters = ''

        for (const ripple of ripples) {
          sample(ripple, col, row, cx, cy, now, probe)
          wave = Math.max(wave, probe.wave)

          if (probe.mark > mark) {
            mark = probe.mark
            settled = probe.settled
            letters = ripple.mark.letters
          }
        }

        const x = col * cellW
        const y = row * LINE_PX

        if (mark > 0.08) {
          // Letters made of letters: the interior spells the wordmark along
          // each row; thin edges fall back to a light ramp; cells the front
          // just crossed are still scrambling toward their letter.
          const ch = !settled
            ? NOISE[hash(col, row, fast) % NOISE.length]
            : mark > SOLID
              ? letters[(col + row * 3) % letters.length]
              : EDGE[Math.min(EDGE.length - 1, Math.floor((mark / SOLID) * EDGE.length))]
          g.globalAlpha = clamp(mark * 1.15, 0, 1)
          g.fillStyle = settled ? colors.mark : colors.front
          g.fillText(ch, x, y)
          continue
        }

        // Sparse dither so the wake reads as texture, not a solid fill.
        const grain = (hash(col, row, slow) % 1000) / 1000

        if (wave < 0.04 || grain > wave * 1.6) {
          continue
        }

        g.globalAlpha = Math.min(1, wave * 1.1)
        g.fillStyle = wave > 0.4 ? colors.front : colors.wake
        g.fillText(NOISE[hash(col, row, wave > 0.55 ? fast : slow) % NOISE.length], x, y)
      }
    }

    g.globalAlpha = 1
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.dimIntro(false)
    this.resizer.disconnect()
    this.canvas.remove()
  }
}

function SettingsPage({ prefs, update }) {
  const { mode } = useValue(prefs)

  return jsx(ListRow, {
    action: jsx(SegmentedControl, { onChange: value => update({ mode: value }), options: MODES, value: mode }),
    description: 'What the wave decodes into when you click the empty chat. Alternate swaps on every click.',
    title: 'Wordmark'
  })
}

export default {
  id: 'glyphwake',
  name: 'Glyphwake',
  register(ctx) {
    const prefs = atom({ mode: 'alternate', ...ctx.storage.get('prefs', {}) })

    const update = patch => {
      prefs.set({ ...prefs.get(), ...patch })
      ctx.storage.set('prefs', prefs.get())
    }

    ctx.registerSettingsPage?.({
      id: 'settings',
      title: 'Glyphwake',
      icon: 'sparkle',
      render: () => jsx(SettingsPage, { prefs, update })
    })

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    // The app loads Collapse for its own wordmark; make sure it's ready before
    // the first click rasterises with it. A miss just falls back to sans.
    document.fonts?.load(`700 64px ${WORDMARK_FONT}`).catch(() => {})

    const layers = new Map()
    let clicks = 0

    const nextWord = () => {
      const { mode } = prefs.get()

      if (mode === 'off') {
        return null
      }

      return mode === 'alternate' ? (clicks++ % 2 ? WORDMARKS.hermes : WORDMARKS.nous) : WORDMARKS[mode]
    }

    const layerFor = bounds => {
      let layer = layers.get(bounds)

      if (!layer) {
        layer = new RippleLayer(bounds)
        layers.set(bounds, layer)
      }

      return layer
    }

    // Tiles come and go; drop layers whose surface left the DOM.
    const prune = () => {
      for (const [bounds, layer] of layers) {
        if (!bounds.isConnected) {
          layer.dispose()
          layers.delete(bounds)
        }
      }
    }

    ctx.addEventListener(
      document,
      'pointerdown',
      event => {
        if (event.button !== 0 || !(event.target instanceof Element)) {
          return
        }

        const bounds = event.target.closest(BOUNDS)

        // Empty means no messages yet, with or without the intro splash.
        const empty = bounds?.querySelector(THREAD) && !bounds.querySelector(MESSAGE)

        if (!empty || event.target.closest(INTERACTIVE)) {
          return
        }

        prune()
        layerFor(bounds).spawn(event.clientX, event.clientY, nextWord())
      },
      { capture: true, passive: true }
    )

    // Theme switches change the variables underneath the cached colors.
    const themeWatch = new MutationObserver(() => {
      for (const layer of layers.values()) {
        layer.resize()
      }
    })
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })

    ctx.onDispose(() => {
      themeWatch.disconnect()

      for (const layer of layers.values()) {
        layer.dispose()
      }

      layers.clear()
    })
  }
}
