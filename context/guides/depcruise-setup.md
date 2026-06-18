# Dependency Cruiser Setup Guide

## Overview

[dependency-cruiser](https://github.com/sverweij/dependency-cruiser) validates and visualizes module dependencies. We use it to enforce vertical slice architecture rules.

## Installation

Each package / app needs its own installation:

```bash
cd packages/your-package
bun add -D dependency-cruiser
```

## Initialize Config

Run the interactive setup:

```bash
bunx depcruise --init
```

Answer the prompts:
- **ESM package?** → Yes
- **Source files location?** → `src`
- **Separate test folder?** → No (unless you have one)
- **Use tsconfig.json?** → Yes
- **TypeScript pre-compilation deps?** → Yes

This creates `.dependency-cruiser.cjs` with sensible defaults.

## Custom Rules for Vertical Slice Architecture

Add these rules to the `forbidden` array in `.dependency-cruiser.cjs`:

Note: These rules are examples and may need to be adjusted based on your specific project structure.

```javascript
// Slices must remain isolated
{
  name: 'no-cross-slice-imports',
  comment: 'Use Public APIs or Event Bus for cross-slice communication.',
  severity: 'error',
  from: { path: '^src/modules/([^/]+)' },
  to: {
    path: '^src/modules/([^/]+)',
    pathNot: [
      '^src/modules/$1',                    // Same slice OK
      '^src/modules/[^/]+/index.ts',        // Public API OK
      '^src/modules/[^/]+/[^/]+.public.ts'  // .public.ts files OK
    ]
  }
},

// Shared cannot depend on modules
{
  name: 'no-module-imports-in-shared',
  comment: 'Shared utilities must be leaf nodes.',
  severity: 'error',
  from: { path: '^src/shared' },
  to: { path: '^src/modules' }
},

// Enforce public API gatekeeper
{
  name: 'enforce-public-api-gatekeeper',
  comment: 'Only import from index.ts or .public.ts files.',
  severity: 'error',
  from: { pathNot: '^src/modules/([^/]+)' },
  to: {
    path: '^src/modules/[^/]+/.+',
    pathNot: [
      '^src/modules/[^/]+/index.ts',
      '^src/modules/[^/]+/[^/]+.public.ts',
      '^src/modules/[^/]+/contract.ts'
    ]
  }
}
```

## Usage

### Validate Dependencies

```bash
cd packages/your-package
bunx depcruise src
```

### Generate SVG Graph

Requires [Graphviz](https://graphviz.org/):

```bash
# Install graphviz (Ubuntu/Debian)
sudo apt install graphviz

# Generate graph
bunx depcruise src --include-only "^src" --output-type dot | dot -T svg > deps.svg
```

### Monorepo Scripts

From the workspace root:

```bash
# Generate SVGs for all packages
bun run depcruise:svg
```

Output goes to `depcruise/<package-name>.svg`.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `depcruise` resolves to wrong package | Install `dependency-cruiser` locally in the package |
| Empty graph (8x8 SVG) | Run from package dir, use `--include-only "^src"` |
| `Can't open config file` | Run `bunx depcruise --init` or use `--no-config` |
| `dot: command not found` | Install Graphviz: `sudo apt install graphviz` |
