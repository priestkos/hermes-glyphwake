<div align="center">

  <a href="https://github.com/NousResearch/hermes-agent">
    <img src="https://github.com/user-attachments/assets/ac2f5702-c842-4b2e-9340-737481fa0ece" width="96" height="96" alt="Nous Research Hermes mark" />
  </a>

  # Glyphwake

  **Click the empty chat. Watch it spell itself.**

  <sub>POWERED BY <a href="https://github.com/NousResearch/hermes-agent">HERMES AGENT</a> &nbsp;·&nbsp; COMMUNITY PLUGIN &nbsp;·&nbsp; VERSION 0.1.1</sub>

</div>

<br />

Glyphwake is a small Hermes Desktop plugin. Click anywhere on the background of
an empty chat and a wave of scrambling characters rolls out from the pointer.
Where it passes, the noise decodes into **K'os Mos** or **Kitsune**,
holds for a moment, then dissolves.

- The wordmark uses Collapse, the typeface Hermes uses for its own lettering, and
  each letter is made of letters.
- It forms around the point you click. The intro splash fades back while it
  shows and returns as it dissolves.
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

Go to **Settings → Plugins → Glyphwake** to choose what the wave decodes into:
both wordmarks in turn (the default), only **K'os Mos**, only
**Kitsune**, or the wave with no wordmark.

## What it touches

- One saved preference, through the plugin SDK's storage.
- A decorative `<canvas aria-hidden>` in the chat area, removed when you turn
  the plugin off.
- The intro splash's opacity while a wordmark is showing. The original value is
  put back afterwards.

Desktop's plugin SDK has no slot behind the empty chat yet, so Glyphwake finds
the chat area through Desktop's own markup. If a Desktop update changes that
markup, the effect switches off. Nothing else breaks.

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
