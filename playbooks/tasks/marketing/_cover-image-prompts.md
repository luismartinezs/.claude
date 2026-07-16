# Cover Image Generation & Prompt Craft

Reference read by `publish-blog-post` when a project's `blog-infra.md` declares a
cover image script. Two halves, matching the doctrine:

- **Generation is global.** The script `~/.claude/playbooks/scripts/marketing/generate-blog-image.ts`
  (Nano Banana 2 / Gemini 3.1 Flash Image via OpenRouter) is the same for every project.
- **The prompt is local.** What a given article's cover should depict is business
  knowledge. The craft rules below are global; the subject you feed them is not.

## Running it

```bash
# from the project root
bun ~/.claude/playbooks/scripts/marketing/generate-blog-image.ts <slug> "<prompt>" [output-dir]
```

- `output-dir` defaults to `apps/frontend/public/images/blog`, resolved against the
  project's working directory. `blog-infra.md`'s "Cover image script" cell records the
  exact invocation with the project's real output dir.
- Output: `<output-dir>/<slug>.webp`. Set frontmatter `image` to the public path
  (e.g. `/images/blog/<slug>.webp`), per `blog-infra.md`'s URL rules.
- Requires `OPENROUTER_API_KEY` in the **project's** `.env` and `cwebp` installed
  (`apt install webp`). If either is missing, `publish-blog-post` STOPs and reports
  `[NEEDS IMAGE]`. It never fabricates an image.

## Prompt Craft

Nano Banana 2 understands intent and composition. Write prompts like a creative
director briefing a photographer, narrative, not keyword tags.

### Structure (write in layers, in this order)

1. **Subject** — What's in the frame. Be specific: "a bookkeeper's desk with a CRT monitor showing a ledger grid" not "office setup."
2. **Setting** — Where and when. "Late evening, small-business back office, warm desk lamp."
3. **Mood/Lighting** — Cinematic direction. Name the light: "soft key light from upper-left, warm rim light separating subject from dark background."
4. **Camera** — Lens and perspective. "Shot on Sony A7III, 35mm f/1.4, shallow depth of field" triggers specific bokeh and compression.
5. **Style anchor** — Cultural shorthand. "National Geographic editorial style," "Wes Anderson color palette," "Kodak Portra 400 warm tones."

### Good prompt

> A solo bookkeeper working late, ledger book open under a warm desk lamp, a calculator and coffee cup in the foreground. Soft key light from the left, city lights through a rain-streaked window behind. Shot on Fujifilm X-T5, 23mm f/1.4. Kodak Portra 400 color palette. Editorial photography style.

### Bad prompt (keyword soup)

> accounting, ledger, money, night, office, 4k, realistic

### Rules

- **The script always appends** `Aspect ratio: 16:9 landscape. Resolution: 1200x675. No text, no watermarks, no logos.` Do not repeat these in your prompt.
- **No text in images.** The model renders text unreliably at small sizes. Titles come from HTML, not the image.
- **Never depict data.** No charts, graphs, or numbers. A cover that shows figures is a data claim that skips fact-check. Covers are atmosphere, not evidence.
- **Film stock references** control color: Kodak Portra 400 (warm, pastel), Fujifilm Velvia 50 (saturated), Kodak Tri-X 400 (contrasty B&W).
- **Name real camera gear** to control depth of field and perspective.
- **Iterate, don't re-roll.** If 80% right, ask for the specific change: "same scene but warmer light, add rain on the window."

### Style categories

| Category | Direction |
|----------|-----------|
| Tutorial/How-to | Clean, well-lit workspace or tool in action. Shallow DOF on the key subject. |
| Opinion/Strategy | Abstract or conceptual. Double exposure, geometric composition, symbolic metaphor. |
| Case study | Real-world setting. Documentary style, natural light, authentic environment. |
| Comparison/List | Top-down flat lay or grid arrangement. Even lighting, organized composition. |
| Announcement | Bold, minimal. Single strong subject with negative space for a mental headline. |

## Cost

~$0.045 per image via OpenRouter. A 100-post blog is ~$4.50 total.
