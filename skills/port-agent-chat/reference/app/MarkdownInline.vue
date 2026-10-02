<script setup lang="ts">
// Render all model text through Vue interpolation, never HTML parsing. Keep inline template
// tags adjacent because added whitespace becomes visible text.
import type { Inline } from './lib/markdown.ts'

defineProps<{ nodes: Inline[] }>()
</script>

<template>
  <template v-for="(node, i) in nodes" :key="i"
    ><code v-if="node.kind === 'code'" class="md-code">{{ node.text }}</code
    ><a
      v-else-if="node.kind === 'link'"
      class="md-link"
      :href="node.href"
      target="_blank"
      rel="noreferrer"
      >{{ node.text }}</a
    ><strong v-else-if="node.kind === 'strong'"><MarkdownInline :nodes="node.children" /></strong
    ><template v-else>{{ node.text }}</template></template
  >
</template>
