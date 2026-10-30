<div align="center">

  <a href="https://github.com/NousResearch/hermes-agent">
    <img src="https://github.com/user-attachments/assets/ac2f5702-c842-4b2e-9340-737481fa0ece" width="96" height="96" alt="Nous Research Hermes mark" />
  </a>

  # Glyphwake

  **Click the empty chat. Watch it spell itself.**

  <sub>POWERED BY <a href="https://github.com/NousResearch/hermes-agent">HERMES AGENT</a> &nbsp;·&nbsp; COMMUNITY PLUGIN &nbsp;·&nbsp; VERSION 0.1.2</sub>

</div>

<br />

Glyphwake is a small Hermes Desktop plugin. Click anywhere on the background of
an empty chat and a wave of scrambling characters rolls out from the pointer.
Where it passes, the noise decodes into **Kitsune** — or into text of your own,
set in the plugin's settings — holds for a moment, then dissolves.

- The wordmark uses Collapse, the typeface Hermes uses for its own lettering, and
  each letter is made of letters.
- It forms around the point you click, set as large as the chat allows and kept
  clear of the composer. Clicks in quick succession layer up to four waves.
- The intro splash steps back while a wordmark shows and returns as it
  dissolves.
- Colors come from your theme, so it works in light, dark and custom themes.
- It runs only on a chat with no messages yet, with the intro splash on or off.
  Clicks on the composer, buttons, links and inputs work as usual.
- If your system has reduced motion turned on, it does nothing.

## Install

```sh
hermes plugins install priestkos/hermes-glyphwake
```

Then open **Capabilities → Plugins** in Hermes Desktop and turn on
**Glyphwake**. Desktop plugins from a package start turned off.

Glyphwake needs Hermes Desktop 0.21.6 or later. It is a single `plugin.js` with
no agent tools, hooks, network calls or build step.

## Settings

**Settings → Plugins → Glyphwake** picks what the wave decodes into.

- **Kitsune** — the default. One word, set as large as the chat allows.
- **Custom** — a text field appears under the choice, up to 40 characters. Your
  text is split on whitespace so each word can take its own line — a short
  stack reads larger than one long run of words — and whichever layout reads
  bigger is the one set, scaled to fit the chat. An empty or blank field draws
  no wordmark at all: the splash is left alone rather than stepped back behind a
  mark with no ink in it.
- **Noise only** — the wave rolls out and dissolves without ever forming a mark.

## What it touches

- Its settings (the wordmark choice and any custom text), through the plugin
SDK's storage.
- A decorative `<canvas aria-hidden>` in the chat area, removed when you turn
  the plugin off.
- The intro splash's opacity while a wordmark is showing. The original value is
  put back afterwards.

Desktop's plugin SDK has no slot behind the empty chat yet, so Glyphwake finds
the chat area through Desktop's own markup. If a Desktop update changes that
markup, the effect switches off. Nothing else breaks.

## Test

```
node --test
```

`test/glyphwake.test.mjs` loads the real `desktop/plugin.js` with stub SDK and
DOM modules, clicks a fake empty chat, and asserts which lines the wordmark is
rasterised from for each setting: Kitsune by default, one line per word for
Custom, nothing for an empty field or noise only, and Kitsune again for settings
saved by an older version. No build step, no dependencies.

## Since 0.1.0

This fork sets its own wordmark and adds the settings to change it.

- The alternating **NOUS RESEARCH** / **HERMES AGENT** wordmarks are gone.
  **Kitsune** is the built-in mark and **Custom** takes any text you want. A
  K'os Mos mark shipped in 0.1.1 and was dropped in 0.1.2.
- A Custom field that is empty, or only whitespace, draws nothing rather than
  dimming the splash behind a mark with no ink in it.
- Settings saved by 0.1.0 still load: a mode the plugin no longer has falls back
  to Kitsune instead of drawing nothing.
- Install from this fork — `priestkos/hermes-glyphwake` — rather than upstream.
- The wordmark logic is covered by `node --test`.

## License

MIT

<br />

> **Community project**
>
> Glyphwake is an independent community plugin. It is not affiliated with,
> endorsed by, sponsored by, or officially associated with
> [Nous Research](https://github.com/NousResearch) or the
> [Hermes Agent project](https://github.com/NousResearch/hermes-agent). Hermes,
> Hermes Agent, and Nous Research are names and marks belonging to their
> respective owners.
