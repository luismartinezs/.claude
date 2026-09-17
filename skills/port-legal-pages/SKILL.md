---
name: port-legal-pages
description: Port config-driven Privacy Policy and Terms of Service pages into an Astro site. Use when asked to add legal pages, a privacy policy, or terms of service to a product. Contains reference pages, the config-extraction pattern, porting steps, and verification checklist.
---

# port-legal-pages: Privacy Policy + Terms of Service

You are porting two static legal pages from a reference codebase. The
reference in `reference/` is one instantiation (Astro pages, Tailwind
`prose` styling). Adapt placement and styling to the target; the
pattern that must survive is the config extraction.

## What the feature is

- `/privacy/` and `/terms/` static pages, prose-styled markdown-ish
  content authored directly in `.astro` files.
- Every product-specific string (site title, URL, company name, contact
  email, postal address) is injected from ONE config object
  (`legal.config.ts`), which itself pulls from the app-wide config where
  possible. The legal text contains zero hardcoded product names.

## Invariants

1. **No hardcoded identity strings in the page bodies.** All of them
   flow from the config object. This is the entire point: the pages are
   reusable because only the config changes per product.
2. **Static pages, no client JS.**
3. **Linked from somewhere reachable** — footer at minimum. Cookie
   banners and signup forms that promise a privacy policy must link to
   a page that exists.

## Known adaptation points

- **Config source.** Reference derives `legalConfig` from a shared
  `APP_CONFIG` (name, url, companyName, email) plus a hardcoded
  address. Wire it to whatever central config the target has; if none,
  create the small config object and note it as the single edit point.
- **The legal TEXT itself.** Read the reference content before reusing
  it. It describes: what data is collected (account info via Google
  OAuth, payment processing via Stripe, analytics), cookies, and
  contact. If the target product collects different data (no auth? no
  payments? different processors?), EDIT the clauses to match reality.
  A privacy policy that misdescribes the product is worse than none.
  List the changed clauses to the user; they carry the legal risk.
- **Styling.** Reference relies on Tailwind `prose` (typography
  plugin). If the target lacks it, either add the plugin or style
  headings/paragraphs with the target's own classes.
- **URLs and trailing slashes.** `/privacy/` and `/terms/` are
  conventional; match the target's routing and trailing-slash config.
- **Jurisdiction.** The reference text is generic US-style boilerplate,
  not jurisdiction-specific advice. Do not invent GDPR/CCPA compliance
  claims that are not in the reference. If the user asks for those,
  tell them to have counsel review; you can only scaffold.

## Porting steps

1. Survey: target layout API, central app config, footer component,
   trailing-slash convention, typography plugin presence.
2. Create/wire the legal config object (title, url, company, email,
   address). Ask the user for company name and address if not in the
   codebase; do not guess these.
3. Port both pages, adapting the Layout wrapper and injecting config
   values. Edit clauses to match what the target product actually does
   (auth provider, payment processor, analytics tool).
4. Add footer links (and anywhere else the target references legal
   pages: signup forms, cookie banner).

## Verification

1. Typecheck + `astro build` pass.
2. Grep the two built pages for the REFERENCE product's identity
   strings (e.g. "SafelyFed") — zero hits. Grep for the target's name —
   present in title and body.
3. Both pages render styled (prose applied), reachable from the footer.
4. Report: config location, every clause edited to match the target
   product, and an explicit note that the text is boilerplate, not
   legal advice.
