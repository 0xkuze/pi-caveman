# caveman-pi

> 🪨 why use many token when few do trick

A [pi](https://github.com/mariozechner/pi-coding-agent) port of [**caveman**](https://github.com/JuliusBrussee/caveman) by [Julius Brussee](https://github.com/JuliusBrussee) — the viral tool that cuts ~75% of output tokens while keeping full technical accuracy.

This extension adapts caveman for pi's extension system, running at the **Ultra** intensity level with a fully native TypeScript implementation (no Python dependency).

## Credits

All credit for the caveman concept, prompt engineering, and compression approach goes to the original project:

- **Original**: [github.com/JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman)
- **Author**: [Julius Brussee](https://github.com/JuliusBrussee)
- **Paper**: [arxiv.org/abs/2604.00025](https://arxiv.org/abs/2604.00025)

This port adapts the Ultra mode prompt and the `caveman-compress` tool for pi's extension API.

## What's different from the original

- **Native pi extension** — hooks into `before_agent_start` for zero-config system prompt injection
- **TypeScript-only** — compress pipeline rewritten from Python to TypeScript, no `python3` dependency
- **Ultra mode only** — runs the most aggressive compression level by default (the sweet spot for coding agents)
- **Toggle via `/caveman`** — on/off without restarting the session

## Before / After

**Normal** (69 tokens):
> "The reason your React component is re-rendering is likely because you're creating a new object reference on each render cycle. When you pass an inline object as a prop, React's shallow comparison sees it as a different object every time, which triggers a re-render. I'd recommend using useMemo to memoize the object."

**Caveman** (12 tokens):
> "Inline obj prop → new ref → re-render. `useMemo`."

Same fix. 75% less word. Brain still big.

## Install

```
pi install npm:caveman-pi
```

## Usage

Toggle on/off with `/caveman`.

When active, every LLM response uses the Caveman Ultra prompt — fragments, abbreviations, symbols over words, no tables, no prose paragraphs.

### `/compress <filepath>`

Compress a markdown/text file into caveman format. Saves ~46% of input tokens every session by stripping fluff while preserving code blocks, URLs, headings, and structure exactly.

- Original backed up as `<filename>.original.md`
- Requires `claude` CLI for LLM calls
- Only compresses `.md`, `.txt`, `.rst` and extensionless natural language files
- Validates output: headings, code blocks, URLs, and paths must match original
- Auto-retries with targeted fixes if validation fails

## Uninstall

```
pi remove npm:caveman-pi
```

## License

MIT — same as the [original caveman project](https://github.com/JuliusBrussee/caveman).
