# Launch video

Source for `public/IndexFast-Launch.mp4` (34.5 s, 1080x1350, 4:5 for the LinkedIn and Instagram feeds,
captions burned in so it works muted) and its poster `public/IndexFast-Launch-poster.jpg`.

- `spec.json`: the scene script for the `kinetic-explainer-video` engine (clean style, recoloured to Cobalt:
  cool paper ground, cobalt accent, no warm accent). Render with `build.py spec.json --out out/launch`.
- `IndexFast-Launch.srt`: word-timed captions for platforms that take a separate caption file.

Claims in the script must stay true to the code: engines (IndexNow, Bing, Yandex, Baidu), Search Console
inspection, MCP/API/CLI, hourly cron. No indexing guarantee, no invented numbers. Voiceover is AI-generated.
