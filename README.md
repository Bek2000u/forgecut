# forgecut

Declarative, JSON-driven video renderer used by
[VideoForge](https://github.com/Bek2000u/videoforge) as its default non-HTML
render backend.

`forgecut` takes a declarative spec (segments, layers, transitions, audio,
subtitles) and renders an MP4 via FFmpeg. The VideoForge worker compiles its
internal `Composition` into a forgecut spec and invokes the CLI:

```bash
forgecut --json spec.json
```

## What's here beyond plain editly

forgecut is derived from [editly](https://github.com/mifi/editly) and keeps its
spec model, with renderer features VideoForge depends on:

- Word-level (karaoke) subtitles with per-word styling
- Sidechain audio ducking (narration over music)
- `onProgress` callback and a configurable encoder

## Use

```bash
npm install -g 'github:Bek2000u/forgecut#main'
forgecut --json spec.json
```

Installing from git builds `dist/` automatically (the `prepare` script runs the
build), so the `forgecut` CLI works straight from a git install.

## Develop

```bash
npm install      # builds dist/ via prepare
npm run build
npm test
```

## License

MIT. Derived from [editly](https://github.com/mifi/editly) by Mikael Finstad; the
original copyright notice is preserved in [LICENSE](LICENSE).
