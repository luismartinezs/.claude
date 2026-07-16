/**
 * Generate a blog cover image using Nano Banana 2 (Gemini 3.1 Flash Image) via OpenRouter.
 *
 * GLOBAL PLAYBOOK SCRIPT. Project-agnostic on purpose: the doctrine is
 * "image prompt is local, image generation is global." The per-article prompt
 * comes from the project (it knows what its images should depict); the mechanics
 * of turning a prompt into an optimized file live here, once, for every project.
 *
 * Usage (run from the target project root, or pass an absolute output dir):
 *   bun ~/.claude/playbooks/scripts/marketing/generate-blog-image.ts <slug> "<prompt>" [output-dir]
 *
 * Output:
 *   <output-dir>/<slug>.webp   (output-dir defaults to ./apps/frontend/public/images/blog)
 *
 * Requires:
 *   - OPENROUTER_API_KEY env var (in the PROJECT's environment, not this repo)
 *   - cwebp installed (apt install webp)
 *
 * Wiring: a project's `blog-infra.md` declares the invocation string in its
 * "Cover image script" cell, with the real output dir baked in. Downstream tasks
 * read that cell; they never hardcode this path.
 */

import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { execSync } from "child_process";
import { resolve } from "path";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error(
    "Error: OPENROUTER_API_KEY not set. This is a per-project credential; add it to the project's .env.",
  );
  process.exit(1);
}

const slug = process.argv[2];
const prompt = process.argv[3];
const outputDirArg = process.argv[4] ?? "apps/frontend/public/images/blog";

if (!slug || !prompt) {
  console.error(
    'Usage: bun ~/.claude/playbooks/scripts/marketing/generate-blog-image.ts <slug> "<prompt>" [output-dir]',
  );
  process.exit(1);
}

// Resolve output dir against the CURRENT WORKING DIRECTORY (the project), not this
// script's location. That is what makes one global copy serve every project.
const OUTPUT_DIR = resolve(process.cwd(), outputDirArg);
const TEMP_PNG = resolve(OUTPUT_DIR, `${slug}.tmp.png`);
const OUTPUT_WEBP = resolve(OUTPUT_DIR, `${slug}.webp`);

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const imagePrompt = [
  prompt,
  "Aspect ratio: 16:9 landscape. Resolution: 1200x675.",
  "No text, no watermarks, no logos.",
].join("\n");

console.log(`Generating image for "${slug}" -> ${OUTPUT_WEBP}`);

const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-3.1-flash-image-preview",
    messages: [{ role: "user", content: imagePrompt }],
    modalities: ["image", "text"],
  }),
});

if (!response.ok) {
  const text = await response.text();
  console.error(`API error (${response.status}): ${text}`);
  process.exit(1);
}

const result = await response.json();
const choice = result.choices?.[0]?.message;

if (!choice?.images?.length) {
  console.error("No image returned. Response:", JSON.stringify(result, null, 2));
  process.exit(1);
}

const dataUrl = choice.images[0].image_url.url;
const base64Match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
if (!base64Match) {
  console.error("Unexpected image format:", dataUrl.slice(0, 80));
  process.exit(1);
}

const buffer = Buffer.from(base64Match[1], "base64");
writeFileSync(TEMP_PNG, buffer);
console.log(`  PNG saved (${(buffer.length / 1024).toFixed(0)} KB)`);

try {
  execSync(`cwebp -q 80 -resize 1200 675 "${TEMP_PNG}" -o "${OUTPUT_WEBP}"`, {
    stdio: "pipe",
  });
  const webpSize = Bun.file(OUTPUT_WEBP).size;
  console.log(`  WebP saved (${(webpSize / 1024).toFixed(0)} KB)`);
} finally {
  if (existsSync(TEMP_PNG)) unlinkSync(TEMP_PNG);
}

console.log(`\nDone: ${OUTPUT_WEBP}`);
