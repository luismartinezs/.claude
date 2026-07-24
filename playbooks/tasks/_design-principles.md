# Design Principles Library
*Distilled from Refactoring UI by Adam Wathan & Steve Schoger.*
*Copy-paste these blocks into design tasks. Each principle is a concrete, actionable rule.*

---

## 1. Hierarchy Through Three Levers

### Principle: Size, Weight, Color (Not Just Size)
*Use when:* Establishing visual hierarchy in any UI.
*Placement:* Before any implementation step.

> **RULE: Three-Color Text System**
> Use exactly three text treatments to establish hierarchy:
> 1. **Primary** — Dark color (e.g., `--color-text`), heavier weight (600-700). For headings and critical data.
> 2. **Secondary** — Medium grey (e.g., `--color-text-secondary`), normal weight (400-500). For supporting text.
> 3. **Tertiary** — Light grey (e.g., `--color-muted`), normal weight. For timestamps, metadata, placeholders.
>
> Do NOT rely on font size alone. A bold 18px heading with a lighter 16px body communicates hierarchy better than a 30px heading with 16px body where both are weight 400.
>
> Stay away from font weights under 400 for UI. They work for large headings but are unreadable at smaller sizes.

> **RULE: The Tertiary Floor**
> "Light grey" is a rank, not a lightness. All three levels are **body text**, and all three must clear the project's contrast bar (AAA 7:1 unless stated otherwise). Tertiary is the level that fails, because it is the one this system keeps pushing lighter.
>
> The three levers are size, weight, and colour. Only colour has an accessibility floor. So when the hierarchy is not reading clearly, **spend size and weight before you spend lightness** — they are unbounded and lightness is not.
>
> If tertiary is at the floor and still competes with secondary, the palette has run out of room between them. Widen the gap by darkening *primary*, or separate the two with size and weight instead. Do not lighten past the floor. Three ranks that are all legible beats four ranks where the last one is grey mush.
>
> Verify, do not estimate. `#999` on white is 2.85:1 and looks perfectly reasonable in an editor.

---

## 2. Emphasize by De-emphasizing

### Principle: Make the Primary Pop by Softening Everything Else
*Use when:* An element needs emphasis but is already at max weight/size.
*Placement:* During implementation.

> **RULE: The Subtraction Method**
> When an element needs to stand out more, don't add emphasis to it. Instead, de-emphasize the elements competing with it.
> - If an active nav item doesn't pop, soften the inactive items to a lighter color.
> - If a sidebar competes with main content, remove the sidebar's background color so it sits on the page background.
> - If a primary button needs to dominate, make secondary actions outline-only or plain text links.
>
> **Action hierarchy for buttons:**
> - **Primary**: Solid background, high contrast. One per page section.
> - **Secondary**: Outline or low-contrast background. Clear but not dominant.
> - **Tertiary**: Styled as text links. Discoverable but unobtrusive.
>
> Destructive actions are NOT automatically primary. If "Delete" isn't the main action, give it secondary/tertiary treatment. Use the bold red style only in the confirmation dialog where it IS the primary action.
>
> **Subtraction is not the same as fading.** De-emphasize by removing devices — drop a background, drop a border, drop a shadow, reduce size, reduce weight, add surrounding space. Reach for lighter text last, and never below the contrast floor.
>
> This rule is applied iteratively, and that is exactly what makes it dangerous: each pass says "soften the competition," so contrast erodes a little every time the hierarchy improves. The loop only runs one way. After any subtraction pass, re-measure the elements you softened.

---

## 3. Labels Are a Last Resort

### Principle: Let Data Speak for Itself
*Use when:* Displaying data from a database, building dashboards, cards, or profiles.
*Placement:* During implementation.

> **RULE: Reduce Label Dependence**
> Before adding a "Label: Value" pattern, try these alternatives in order:
> 1. **Context makes it obvious.** An email format, a phone number, a price — the format IS the label. Drop the label entirely.
> 2. **Combine label into value.** Instead of "In stock: 12", write "12 left in stock". Instead of "Bedrooms: 3", write "3 bedrooms".
> 3. **When you must use a label**, de-emphasize it. Make it smaller, lighter weight, or uppercase in a reduced size. The DATA is what matters, not the label.
> 4. **Exception: spec tables.** When users scan for a specific label (like "Dimensions" on a product page), emphasize the label, not the value.

---

## 4. Spacing Creates Relationships

### Principle: Proximity Over Borders
*Use when:* Laying out forms, lists, cards, sections.
*Placement:* During spacing/layout phase.

> **RULE: Asymmetric Spacing**
> Related elements should be closer together than unrelated elements. Uniform spacing makes groups ambiguous.
> - In forms: space between a label and its input should be LESS than the space between form groups. Example: 10px label-to-input, 20px between groups.
> - In article layout: more space ABOVE a section heading than below it. The heading belongs to the content that follows, not the content above.
> - In lists with icons/actions: inner spacing (between icon and text) should be less than outer spacing (between list items).
>
> **The test:** Squint at your layout. Can you identify distinct groups? If everything looks like one continuous stream, your spacing is too uniform.

---

## 5. Start with Too Much White Space

### Principle: Remove, Don't Add
*Use when:* Starting any layout.
*Placement:* First implementation step.

> **RULE: Space Subtraction**
> Begin with generous (excessive) white space. Then remove it until things feel right.
> The opposite approach (adding space until things stop looking cramped) always results in "minimum viable spacing" that looks acceptable but never looks great.
>
> **Exception:** Dense UIs (dashboards, data tables, admin panels) have legitimate reasons for compact spacing. Make density a deliberate choice, not a default.
>
> **Don't fill the screen.** If content only needs 600px, use 600px. A checkout page centered in a narrow column with breathing room looks better than one stretched to 1200px. Give elements the width they need, not the width you have.

---

## 6. Constrained Systems

### Principle: Define Values Up Front, Choose from the System
*Use when:* Setting up any design system or starting a project.
*Placement:* Before design system creation.

> **RULE: Pre-defined Scales**
> Define a constrained set of values for every design dimension. Never hand-pick arbitrary values per-element.
>
> **Spacing scale** (base 16px, non-linear): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 640, 768px.
> At the small end, 2-4px jumps matter. At the large end, 128px vs 140px is imperceptible.
>
> **Type scale** (hand-crafted, not modular ratio): 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72px.
> Modular scales produce fractional values and too-tight or too-wide gaps. Hand-pick sizes and round to integers. Use px or rem, never em (nesting breaks em scales).
>
> **Color**: 8-10 shades per color. 9 is ideal (100-900 naming). Pick base (500), darkest (900), lightest (100), then fill gaps.
>
> **Shadow**: 5 levels is enough. Small (buttons), medium (dropdowns), large (modals).
>
> When choosing a value, pick the closest from your scale, try the neighbors, eliminate the obvious misfit. Designing by elimination is faster than designing by invention.

---

## 7. Color Palette Architecture

### Principle: Three Categories, Multiple Shades Each
*Use when:* Building a color system.
*Placement:* During design system creation.

> **RULE: Greys + Primary + Accents**
> A real palette has three categories:
> 1. **Greys** (8-10 shades): Used everywhere. Text, backgrounds, panels, borders, form controls. Start with a dark grey (not true black) and a subtle off-white. Fill in between.
> 2. **Primary** (5-10 shades): The brand color. Used for primary actions, active navigation, emphasis. Light shades for tinted backgrounds, dark shades for text.
> 3. **Accent/Semantic** (5-10 shades each): Red (errors/destructive), yellow/amber (warnings), green (success/positive), teal/cyan (info/highlights). Each needs its own shade range.
>
> **Greys don't have to be grey.** Saturate your greys with a hint of your primary hue (12-20% saturation). Blue-tinted greys feel cool and professional. Yellow/orange-tinted greys feel warm.
>
> **Don't let lightness kill saturation.** As a color approaches 0% or 100% lightness, saturation has less visual impact. Increase saturation as you move away from 50% lightness to keep shades vibrant. You can also rotate the hue: toward 60/180/300 for lighter shades, toward 0/120/240 for darker ones.

---

## 8. Text on Colored Backgrounds

### Principle: Hand-Pick, Don't Opacity
*Use when:* Placing secondary text on colored sections, dark panels, or hero images.
*Placement:* During color implementation.

> **RULE: No White-with-Opacity for De-emphasis**
> When you need lighter text on a colored background, do NOT use `rgba(255,255,255,0.6)` — it looks washed out and faded.
> Instead, hand-pick a color with the same hue as the background, then adjust saturation and lightness until the contrast looks right.
>
> For dark text on light colored backgrounds (badges, alerts): use a darker shade of the background hue, not grey.
>
> To maintain contrast on colored backgrounds, consider flipping the pattern: dark text on a light tinted background (e.g., dark green text on light green) is easier to make accessible than white text on a dark background.

---

## 9. Typography Rules

### Principle: Line-Height is Proportional, Not Fixed
*Use when:* Setting typography styles.
*Placement:* During type system setup.

> **RULES:**
> - **Line-height scales inversely with font size.** Small text (14px) needs more line-height (1.5-1.75). Large headings (36px+) need less (1-1.2). A fixed 1.5 everywhere is wrong.
> - **Line length: 45-75 characters.** Set `max-width: 20-35em` on paragraphs. Even if the container is wider, constrain the text. Different widths in the same content area is fine.
> - **Left-align by default.** Center only for short, independent blocks (headings, CTAs). Never center paragraphs longer than 2-3 lines.
> - **Right-align numbers** in tables so decimal points line up.
> - **Baseline-align mixed font sizes.** When a heading and a small action sit on the same line, use `align-items: baseline`, not `center`.
> - **Tighten headline letter-spacing.** Fonts designed for body text have wider letter-spacing. At large sizes, tighten with `letter-spacing: -0.02em` to `-0.05em`.
> - **Widen all-caps letter-spacing.** All-caps removes the visual variety of ascenders/descenders. Add `letter-spacing: 0.05em` for readability.

---

## 10. Shadows and Depth

### Principle: Shadows Convey Elevation, Not Decoration
*Use when:* Adding depth to elements.
*Placement:* During finishing touches.

> **RULES:**
> - **Shadows have two parts.** A larger, softer shadow simulates direct light (large offset, large blur, low opacity). A smaller, tighter shadow simulates ambient occlusion (small offset, small blur, slightly higher opacity). Combine both for natural-looking elevation.
> - **Five elevation levels** are enough: `sm` (buttons), `md` (dropdowns), `lg` (modals). Smaller shadow = closer to page. Larger shadow = floating above.
> - **Shadows interact with actions.** On hover, increase shadow (element rises). On click, decrease shadow (element presses down). This creates tactile feedback.
> - **Flat designs still have depth.** Use background color differences (lighter = closer, darker = recessed) instead of shadows. A solid, vertically-offset shadow with zero blur is another flat-friendly technique.
> - **Raised elements:** Light top edge (inset box-shadow or top border with lighter shade), dark bottom shadow. Light comes from above.
> - **Inset elements:** Dark top edge (inset box-shadow from above), lighter bottom edge.

---

## 11. Use Fewer Borders

### Principle: Box Shadows, Backgrounds, and Spacing Replace Most Borders
*Use when:* Separating elements or sections.
*Placement:* During implementation, replaces default border instinct.

> **RULE: Border Alternatives**
> Before adding a border, try these alternatives:
> 1. **Box shadow.** Subtler than a border, defines the edge without the visual weight. `box-shadow: 0 5px 15px rgba(0,0,0,0.08)`
> 2. **Different background colors.** Adjacent elements with slightly different backgrounds (e.g., white card on off-white page) create natural separation without borders.
> 3. **Extra spacing.** Simply adding more space between elements is often enough to make grouping clear.
>
> If you DO need a border, make it soft: light color, and consider increasing width to 2px rather than darkening a 1px border. A thicker, lighter border feels balanced; a thin, dark border feels harsh.

---

## 12. Finishing Touches

### Principle: Supercharge Defaults, Add Accent Borders, Design Empty States
*Use when:* A design feels "done" but still plain.
*Placement:* Final implementation pass.

> **TACTICS:**
> - **Replace bullet points with icons.** Colored checkmarks, contextual icons (padlock for security features) make lists feel designed.
> - **Promote quotes.** Increase size, change color, add a large decorative quotation mark.
> - **Custom form elements.** Replace browser-default checkboxes, radios, and selects with brand-colored versions.
> - **Accent borders.** A 3-4px colored bar across the top of a card, along the side of an alert, under a heading, or at the top of the viewport. Zero design talent required, big visual impact.
> - **Background color changes.** Break page monotony by giving a section a tinted or dark background. For gradients, keep the two hues within 30 degrees of each other.
> - **Empty states are not afterthoughts.** When a screen depends on user content, design the empty state first. Use an illustration, a clear message, and a prominent CTA. Hide unnecessary UI (filters, tabs) until there's content to act on.
> - **Don't rely on color alone.** Always pair color with another signal (icon, text label, position) for colorblind accessibility.

---

## 13. Process

### Principle: Feature First, Detail Later, Work in Cycles
*Use when:* Starting any design work.
*Placement:* Before any implementation.

> **PROTOCOL:**
> 1. **Start with a feature, not a layout.** Don't design the navigation first. Design the core feature (the form, the data display, the interaction). The shell comes after you know what goes in it.
> 2. **Design in grayscale first.** Force hierarchy through spacing, size, and weight. Add color last. If it doesn't work in grayscale, color won't fix it.
> 3. **Work in short cycles.** Design a simple version → build it → iterate on the working thing → design the next piece. Don't design the whole app before building anything.
> 4. **Be a pessimist.** Don't design features you aren't ready to build. A comment system without attachments ships sooner than a comment system that waits for attachment support.
> 5. **Choose a personality** through four concrete levers: **font** (serif = elegant, rounded sans = playful, neutral sans = professional), **color** (blue = safe, pink = fun, gold = luxury), **border-radius** (none = serious, small = neutral, large = playful), **language** (formal vs casual).

---

## 14. Responsive Scaling

### Principle: Elements Scale Independently, Not Proportionally
*Use when:* Making responsive designs.
*Placement:* During responsive implementation.

> **RULE: Independent Scaling**
> Do not scale everything by the same ratio at different breakpoints. Large elements should shrink faster than small elements.
> - A 45px desktop headline should NOT be `2.5em` that automatically scales. It should be explicitly 24px on mobile. The body text might only go from 16px to 14px.
> - Button padding should be disproportionate: large buttons get more generous padding, small buttons get tighter padding. Not the same ratio.
> - Don't use percentage-based widths for everything. A sidebar should be a fixed width (e.g., 240px) with the main content taking the rest, not 25%/75% that makes the sidebar too wide on big screens and too narrow on small ones.
> - Use `max-width` over percentage widths. Let elements be their ideal size and only shrink when the screen forces it.
