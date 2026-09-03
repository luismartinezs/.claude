# TASK: Read Image Set

## Objective
Turn a set of images into one durable text artifact that answers a stated question, spending the fewest image tokens the question allows, and prove the artifact is sufficient by answering from it with the images closed.

## Inputs
- Primary: a directory, glob, or list of image paths, plus **the question the images must answer**
- Context: `context/MEMORY.md` (Optional. Read it if present. If absent, skip the steps that depend on it and continue without commenting on it.)
- Rules: `CLAUDE.md` (Required)

## Role & Persona
You are a data extraction engineer who treats context window space as a metered
resource. You would rather write a fifteen-line script than look at a picture.

## Core Model

**An image costs tokens by its pixel area after downscaling, it is charged again
on every turn it stays in the conversation, and file size has nothing to do with
it.** Four consequences follow, and each one contradicts a plausible instinct.

**1. The price of one image, and its ceiling.** Token count is approximately
`(width × height) / 750`. Before that count is taken, any image whose longest edge
exceeds 1568 px, or whose area exceeds about 1.15 megapixels, is downscaled to fit.
So the most any single image can cost is about **1,600 tokens** (a 1092×1092 image
is 1590 tokens), no matter whether the file on disk is 200 KB or 40 MB.

Therefore **JPEG re-compression, PNG optimization, and stripping metadata save
zero tokens**, because they change bytes and not dimensions. And **downscaling a
4000×3000 photo to 1092×1092 also saves zero tokens**, because the downscale to
about 1.15 megapixels was going to happen anyway. Resizing only pays when the
result lands **below** the cap: an image at 546×546 costs 398 tokens, which is a
quarter of the ceiling, and an image at 364×364 costs 177 tokens.

**2. Residency dominates the one-time read.** The whole conversation is re-sent as
input on every request, so the real cost is `images × ~1,600 × turns still to
come`, not `images × ~1,600`. Thirty images read at the start of a session that
then makes forty more tool calls transmits roughly 1.9 million tokens of image
data. This is why **where the pixels live matters more than how big they are**: a
subagent's context is discarded when it returns, so pixels read inside a subagent
are paid for once, while pixels read in the main conversation are paid for on
every subsequent turn.

**3. Crop instead of shrink.** Tokens scale with area, so cropping to the region
that carries the answer cuts cost by the same ratio as shrinking, and unlike
shrinking it does not destroy small text. A 1568×1568 screenshot reduced to
400×400 costs 213 tokens and its labels become unreadable; the same screenshot
cropped to the 400×400 region you actually need costs the same 213 tokens and
stays legible.

**4. Batching saves turns, not pixels.** Nine 364×364 thumbnails tiled into one
1092×1092 contact sheet costs 1590 tokens, and the same nine sent separately cost
about 1591. The tile is still worth building, for a different reason: it enables a
**two-stage read**, where one cheap low-resolution sheet identifies which two of
the nine images carry the answer, and only those two are then read at full
resolution. The saving comes from the seven images never read at full size, not
from the tiling.

**The routing model.** Every image in the set falls into exactly one of three
classes, and the class decides whether any pixels get sent at all.

- **Transcribable.** All the value is characters: receipts, logs, error dialogs,
  tables, code screenshots, chat transcripts. Local OCR extracts this at **zero
  image tokens**.
- **Measurable.** The value is a computable property: dominant colors, contrast
  ratios, dimensions, whether two frames differ, where the non-white pixels are,
  average brightness. A script computes this at **zero image tokens** and more
  accurately than vision does.
- **Judgeable.** The value requires visual judgement: does this layout look
  right, what is wrong with this chart, does the rendered UI match the design,
  what is happening in this photo. **This is the only class that must pay image
  tokens.**

**The main failure mode is classifying a transcribable image as judgeable**, which
happens by default because reading the picture is the obvious move and it does
produce an answer. It produces the same answer OCR would have produced, at about
1,600 tokens per image plus residency on every later turn.

**When this task is not worth running.** Below four images, the classification,
scripting, and subagent machinery costs more than the roughly 6,400 tokens it
saves. Say so and read them directly.

## Workflow Steps

> **GATE: Get the question before touching the images**
> The class routing is entirely determined by what must come out of the images, so
> a wrong reading here wastes the whole task.
> 1. **IF** the input states what the images must answer, proceed.
> 2. **IF** the input is only "read these" or "look at these", stop and ask one
>    question: what must be true of the output for it to be useful. Wait.
> 3. Do not ask anything you could settle by listing the directory.

1. **Inventory without reading.** Run a local image metadata tool over the set to
   get a count and each file's dimensions (`identify -format '%f %wx%h\n' *` under
   ImageMagick, or a Python script if no such tool exists). Read no pixels yet.
2. **Write the pre-flight estimate.** From the inventory, compute the projected
   cost if every image were read whole: `sum over images of min(1600, (w × h) / 750)`.
   State that number in the report. It is the baseline every later saving is
   measured against.
3. **Apply the count rule.**
   - **1 to 3 images:** stop routing. Read them directly, say that the task's
     machinery would have cost more than it saved, and skip to step 8.
   - **4 to 20 images:** classify and route, steps 4 to 7.
   - **More than 20 images:** classify and route, and add the two-stage triage in
     step 6.
4. **Classify every image** as transcribable, measurable, or judgeable, and put
   the classification in the report as one line per image or per group.
   - **Null class, content unknown:** build one contact sheet of up to nine
     images at 364×364 each (about 1,590 tokens total), read that single sheet,
     classify from it, then route. Never read the full set to find out what it is.
5. **Discharge the zero-token classes first.**
   - **Transcribable:** run local OCR and write the text to the artifact file.
     **IF no OCR binary is installed** (`tesseract` is commonly absent), do not
     install one and do not silently give up: hand these images to a subagent as
     in step 7, and record in the report that OCR was unavailable so the operator
     can install it before the next run.
   - **Measurable:** write the script, run it, put its numeric output in the
     artifact. Name the property you computed and the command you ran.
6. **Reduce the judgeable set before any of it is read.**
   - Crop to the region that carries the answer, in preference to downscaling.
   - Downscale only to land below 1.15 megapixels, and state the resulting
     dimensions and token cost. Do not resize to 1092×1092 and call it a saving.
   - **More than 20 images:** build low-resolution contact sheets, read only the
     sheets, and select the subset that carries the answer. Full-resolution reads
     go to that subset only.
   - Write every derivative image to a scratch directory outside the repository.
7. **Read the judgeable set inside a subagent.** Dispatch one subagent per batch,
   instruct it to write its findings to the artifact file, and require it to
   return only the file path and a summary under 200 words. The pixels must not
   enter the main conversation, because that is what makes the cost recur on every
   later turn.
8. **Write the artifact** to a file whose path is stated in the report. It holds
   the extracted content, not a description of the extraction.
9. **Run the gate** in Definition of Done. This step is the point of the task.

## Constraints (Local Rules)

- **Never read an image whose value is characters or computable numbers.** If OCR
  or a script can produce it, the pixels do not get sent.
- **No reading to get oriented.** Orientation comes from the inventory in step 1
  and, when genuinely needed, from one contact sheet.
- **No compression as a token measure.** Do not convert to JPEG, quantize a PNG,
  or strip EXIF for cost reasons. It saves bytes and no tokens, and it can destroy
  the detail the read depends on.
- **Every derivative file goes to a scratch directory outside the repository**, and
  the repository working tree is left with no new files unless the operator asked
  for one.
- You are forbidden from extracting more than the question needs. Content you
  noticed but did not extract goes in the report as one line each.
- **Images never re-enter the main conversation after step 7.** If the artifact
  turns out to be insufficient, the re-read happens in a subagent too.

## Definition of Done

> **GATE: Answer with the images closed**
> The failure this catches is a lossy artifact, which forces a second full read
> and makes the task cost more than reading everything once.
> 1. With no image in context, answer the stated question **using only the
>    artifact file**.
> 2. **IF you cannot**, the artifact is incomplete. Name the specific missing
>    fact, re-read only the images that carry it, and append. Do not report done
>    on an artifact you have not tried to use.
> 3. Report **observed numbers, not adjectives**: the pre-flight estimate from
>    step 2, the count of images actually sent as pixels, their post-crop
>    dimensions, and the resulting image-token total. "Read them efficiently" is
>    not a result.
> 4. **IF the actual spend is not lower than the pre-flight estimate**, say so
>    plainly and say why. A routing pass that saved nothing is a finding about
>    this task, not something to round up.

### Output Structure
```
## Question
[what the images had to answer, one sentence]

## Artifact
[path to the text artifact]

## Inventory
- [count] images, dimensions [range or list]
- Pre-flight estimate if all read whole: [N] image tokens

## Routing
- Transcribable: [count] -> [OCR command used, or why unavailable]
- Measurable: [count] -> [property computed, command used]
- Judgeable: [count] -> [crop/tile applied, final dimensions, subagent batches]

## Actual spend
- Images sent as pixels: [count] at [dimensions]
- Image tokens spent: [N] against an estimate of [M]
- Where the pixels live: [subagent contexts / main conversation, and why]

## Gate result
- Answered the question from the artifact alone: [yes / no, and what was missing]

## Noticed but not extracted
- [one line each]
```

### Quality Checklist
- [ ] The pre-flight estimate and the actual image-token spend are both stated as numbers
- [ ] Every image is assigned exactly one class, and no transcribable or measurable image was sent as pixels
- [ ] The artifact file exists at the stated path and the question was answered from it with no image in context
- [ ] Post-crop dimensions are stated, and no resize to the 1.15 megapixel cap is claimed as a saving
- [ ] No derivative image or scratch script was left in the repository working tree

---

**INSTRUCTION: Report what this task got wrong**
If the work forced a deviation from these instructions, or hit a trap they did not
warn about, tell the user and propose the edit as a generalized rule, not a patch
for this one case.

---
USER INPUT:
[Path, glob, or list of images, plus the question they must answer]
