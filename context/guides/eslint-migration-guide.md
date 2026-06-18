# 🛡️ Vertical Slice Architecture: ESLint Migration Guide

> **"Linting isn't about style. It's about preventing architectural decay."**

This guide provides the exact steps to replicate the strict, functional, and vertical-slice-aware ESLint configuration from this codebase to a new **Bun + TypeScript** project.

---

## 1. Dependency Injection (The Bad Kind)
We need to install the bare minimum tools. No fluff.

Run this in your new project root:

```bash
bun add -d eslint @eslint/js globals typescript-eslint eslint-plugin-import
```

> **Note:** We use `typescript-eslint` for the parser and plugin. `eslint-plugin-import` is essential for checking boundaries.

---

## 2. The Configuration (`eslint.config.ts`)
Create `eslint.config.ts` in your root. This uses the **Flat Config** format (the new standard).

**Crucial:** This config enforces **Vertical Slice Architecture**. It prevents "spaghetti code" by forbidding slices from talking to each other's internals.

```typescript
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
// @ts-ignore - plugin-import doesn't have types for flat config yet
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // ---------------------------------------------------------
      // 🛡️ ARCHITECTURAL BOUNDARIES via eslint-plugin-import
      // ---------------------------------------------------------
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // ---------------------------------------------------
            // RULE 1: Slices must be ISOLATED.
            // Slices cannot import from other slices' internals.
            // ---------------------------------------------------
            {
              // ⚠️ YOU MUST UPDATE THIS LIST FOR YOUR MODULES ⚠️
              // Example: prohibiting 'billing' from importing 'auth' internals
              target: "./src/modules/billing",
              from: "./src/modules/!(billing|shared)",
              message: "❌ BOUNDARY VIOLATION: Cross-slice coupling detected. Use Public APIs or the Event Bus.",
            },

            // ---------------------------------------------------
            // RULE 2: Shared must be BLIND.
            // Shared utilities cannot import from business logic.
            // ---------------------------------------------------
            {
              target: "./src/shared",
              from: "./src/modules",
              message: "❌ SHARED INFECTION: Shared utilities must remain 'pure' and context-blind.",
            },

            // ---------------------------------------------------
            // RULE 3: Enforce Public API Gatekeepers.
            // You cannot import raw files from a module (e.g. /auth/components/Btn)
            // outside of that module. You must use the index.ts or .public.ts
            // ---------------------------------------------------
            {
              target: "./src/modules",
              from: "./src/modules/**/!(index|*.public).ts",
              message: "❌ ENCAPSULATION BREACH: Private internal import detected. Use the .public.ts gatekeeper.",
            },
          ],
        },
      ],
      // ---------------------------------------------------------
      // END ARCHITECTURE RULES
      // ---------------------------------------------------------

      // Enforce import order consistency
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
        },
      ],
    },
  },
);
```

---

## 3. The "Manual Labor" (Why it's good for you)
You might notice the explicit paths in `zones` (e.g., `./src/modules/billing`).

**"Can't I just wildcard this?"**
Technically, yes, but **don't**.
Explicitly defining your boundaries forces you to acknowledge them. When you add a new slice, you add a new rule. It takes 10 seconds and saves you 10 hours of debugging a circular dependency hell 6 months from now.

### Instructions:
1.  **Shared Rule**: The `target: "./src/shared"` rule is generic and works out of the box if you follow the `src/modules` vs `src/shared` structure.
2.  **Slice Rule**: For *each* module you create (e.g., `auth`, `payments`, `users`), you might need to add a zone entry if you want strict isolation, or rely on the generic "Public API" rule.
3.  **Public API Rule**: The last rule (`target: "./src/modules"`) is generic. It says "If I am explicitly inside `src/modules`, I cannot import anything extending `.ts` unless it is `*.public.ts` or `index.ts`". **This is the most powerful rule.**

---

## 4. Run It
Add this to your `package.json`:

```json
"scripts": {
  "lint": "eslint ."
}
```

Run `bun lint`. If you broke a boundary, it will yell at you. **Good.**

---

## 5. Going Further: Dependency Cruiser
ESLint is great for file-by-file checks. But if you want to visualize your spaghetti or enforce strict DAGs (Directed Acyclic Graphs), use `dependency-cruiser`.
It's already in the repo (`.dependency-cruiser.cjs`), but that's a lesson for another day. Start with ESLint.

**Now go build something clean.**
