/**
 * Glyphwake's word logic, exercised against the real desktop/plugin.js.
 *
 * The plugin module is copied to a temp dir with only its two import
 * specifiers pointed at the stubs below, then registered with a fake SDK
 * context and DOM. What is asserted is what the plugin hands to
 * `canvas.fillText` — the lines the wordmark is rasterised from.
 *
 *   node --test test/
 */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { pathToFileURL } from 'node:url'

const SDK_STUB = `export const atom = initial => {
  let value = initial
  return { get: () => value, set: next => { value = next } }
}
export const useValue = prefs => prefs.get()
export const ListRow = 'ListRow'
export const SegmentedControl = 'SegmentedControl'
export const Input = 'Input'
`

const JSX_STUB = `export const Fragment = Symbol('Fragment')
export const jsx = (type, props) => ({ type, props })
export const jsxs = (type, props) => ({ type, props })
`

// --- fake DOM -------------------------------------------------------------

let drawnLines = []

const context2d = () => ({
  fillStyle: '',
  font: '',
  globalAlpha: 1,
  imageSmoothingQuality: '',
  letterSpacing: '',
  textAlign: '',
  textBaseline: '',
  clearRect() {},
  drawImage() {},
  fillText: line => drawnLines.push(String(line)),
  getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h) * 4) }),
  measureText: text => ({ width: Math.max(1, String(text).length) * 50 }),
  setTransform() {}
})

const node = () => {
  const el = {
    children: [],
    isConnected: true,
    style: {},
    appendChild: child => el.children.push(child),
    getBoundingClientRect: () => ({ height: 620, left: 0, top: 0, width: 900 }),
    prepend: child => el.children.push(child),
    querySelector: () => null,
    remove() {},
    setAttribute() {}
  }

  return el
}

const bounds = node()
const thread = node()
bounds.querySelector = selector => (selector.includes('thread') ? thread : null)

globalThis.Element = class Element {}
globalThis.MutationObserver = class {
  disconnect() {}
  observe() {}
}
globalThis.ResizeObserver = class {
  disconnect() {}
  observe() {}
}
globalThis.cancelAnimationFrame = () => {}
globalThis.requestAnimationFrame = () => 0
globalThis.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: false }) }
globalThis.getComputedStyle = () => ({
  color: 'rgb(10, 10, 10)',
  getPropertyValue: name => (name === '--composer-measured-height' ? '140px' : '0')
})
globalThis.document = {
  addEventListener() {},
  createElement(tag) {
    const el = node()

    if (tag === 'canvas') {
      el.getContext = () => context2d()
    }

    return el
  },
  documentElement: node(),
  fonts: { load: () => Promise.resolve() }
}

// --- load the real plugin -------------------------------------------------

const work = await mkdtemp(join(tmpdir(), 'glyphwake-'))

after(() => rm(work, { force: true, recursive: true }))

const source = await readFile(new URL('../desktop/plugin.js', import.meta.url), 'utf8')
const rewritten = source
  .replace("from '@hermes/plugin-sdk'", "from './sdk-stub.mjs'")
  .replace("from 'react/jsx-runtime'", "from './jsx-stub.mjs'")

assert.notEqual(rewritten, source, 'plugin.js imports changed shape — update the stubs')
assert.equal(rewritten.split('\n').length, source.split('\n').length, 'rewrite must only touch import specifiers')

await writeFile(join(work, 'sdk-stub.mjs'), SDK_STUB)
await writeFile(join(work, 'jsx-stub.mjs'), JSX_STUB)
await writeFile(join(work, 'plugin-under-test.mjs'), rewritten)

const { default: plugin } = await import(pathToFileURL(join(work, 'plugin-under-test.mjs')).href)

// --- drive it -------------------------------------------------------------

const storage = {}
let click
let settingsRender

function register() {
  plugin.register({
    addEventListener: (_target, _type, handler) => {
      click = handler
    },
    onDispose() {},
    registerSettingsPage: page => {
      settingsRender = page.render
    },
    storage: { get: (key, fallback) => (key in storage ? storage[key] : fallback), set: (key, value) => (storage[key] = value) }
  })
}

const clickEvent = () => ({
  button: 0,
  clientX: 450,
  clientY: 300,
  target: Object.assign(new Element(), {
    closest: selector => (selector.includes('composer-bounds') ? bounds : null)
  })
})

/** Line the wordmark decodes into for a given saved prefs blob. */
function wordmarkFor(prefs) {
  storage.prefs = prefs
  register()
  drawnLines = []
  click(clickEvent())

  return drawnLines
}

function settingsTreeFor(prefs) {
  storage.prefs = prefs
  register()
  const page = settingsRender()

  return page.type(page.props).props.children.filter(Boolean) // `false` rows render nothing
}

test('Kitsune is the default wordmark', () => {
  assert.deepEqual(wordmarkFor({ mode: 'kitsune' }), ['Kitsune'])
})

test('custom text decodes into its own words, one line each', () => {
  assert.deepEqual(wordmarkFor({ mode: 'custom', text: "K'os Mos" }), ["K'os", 'Mos'])
})

test('a single short custom word stays on one line', () => {
  assert.deepEqual(wordmarkFor({ mode: 'custom', text: 'Hi' }), ['Hi'])
})

test('an empty custom field draws no wordmark', () => {
  assert.deepEqual(wordmarkFor({ mode: 'custom', text: '   ' }), [])
})

test('noise only draws no wordmark', () => {
  assert.deepEqual(wordmarkFor({ mode: 'off' }), [])
})

test('prefs from an older version fall back to Kitsune', () => {
  assert.deepEqual(wordmarkFor({ mode: 'kos' }), ['Kitsune'])
  assert.deepEqual(wordmarkFor({ mode: 'alternate' }), ['Kitsune'])
})

test('the text field appears only for Custom, holding the saved text', () => {
  const custom = settingsTreeFor({ mode: 'custom', text: 'Hello' })
  const field = custom[1].props.action.props

  assert.equal(custom.length, 2)
  assert.equal(field.value, 'Hello')
  assert.equal(field.maxLength, 40)
  assert.equal(settingsTreeFor({ mode: 'kitsune' }).length, 1)
})
