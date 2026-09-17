# PWA integration snippets

## 1. Service worker registration (site layout, end of `<body>`)

```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
</script>
```

## 2. Manifest link (layout `<head>`)

```html
<link rel="manifest" href="/site.webmanifest" />
```

## 3. Build-hash cache busting (astro.config.mts)

`sw.js` contains the literal placeholder `__BUILD_HASH__` in its cache
name. This Vite plugin rewrites it after each build so every deploy gets
a fresh cache name and old caches are purged by the activate handler:

```ts
import { readFileSync, writeFileSync } from 'node:fs';

function swCacheVersion(): import('vite').Plugin {
  return {
    name: 'sw-cache-version',
    apply: 'build',
    closeBundle() {
      const swPath = 'dist/sw.js';
      const content = readFileSync(swPath, 'utf-8');
      writeFileSync(
        swPath,
        content.replace('__BUILD_HASH__', Date.now().toString(36))
      );
    },
  };
}

// register under vite.plugins in defineConfig:
// vite: { plugins: [swCacheVersion(), ...] }
```

Adjust `dist/sw.js` if the target's build output directory differs
(`outDir` in its Astro config).
