<script setup lang="ts">
// A message, rendered. The agent writes markdown, so the two places that show its words render it
// as markdown rather than as the asterisks and backticks it typed.
//
// The parse is a computed, so it happens once per distinct body rather than on every poll: both
// screens re-render on a five- or two-second tick, and the text almost never changes between two
// of them.
import { computed } from 'vue'
import { parseMarkdown } from './lib/markdown.ts'
import MarkdownInline from './MarkdownInline.vue'

const props = defineProps<{ text: string }>()

const blocks = computed(() => parseMarkdown(props.text))
</script>

<template>
  <div class="md">
    <template v-for="(block, i) in blocks" :key="i">
      <pre v-if="block.kind === 'code'" class="md-pre"><code>{{ block.text }}</code></pre>

      <component
        :is="`h${Math.min(block.level + 2, 6)}`"
        v-else-if="block.kind === 'heading'"
        class="md-h"
      >
        <MarkdownInline :nodes="block.inlines" />
      </component>

      <ol v-else-if="block.kind === 'list' && block.ordered" class="md-list" :start="block.start">
        <li v-for="(item, j) in block.items" :key="j"><MarkdownInline :nodes="item" /></li>
      </ol>

      <ul v-else-if="block.kind === 'list'" class="md-list">
        <li v-for="(item, j) in block.items" :key="j"><MarkdownInline :nodes="item" /></li>
      </ul>

      <p v-else class="md-p"><MarkdownInline :nodes="block.inlines" /></p>
    </template>
  </div>
</template>
