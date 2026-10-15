<script setup lang="ts">
import Skeleton from "./Skeleton.vue"

/**
 * Task rows that have not loaded: a completion circle and a title of varying
 * length, at a row's own height, so the real rows take their place without
 * the panel changing size.
 */
withDefaults(defineProps<{ count?: number }>(), { count: 4 })

const WIDTHS = ["w-3/5", "w-2/5", "w-4/5", "w-1/2", "w-2/3"]
</script>

<template>
  <div class="list" aria-busy="true" data-testid="skeleton-rows">
    <div v-for="index in count" :key="index" class="row">
      <span class="skeleton h-4 w-4 flex-none rounded-full motion-safe:animate-pulse" aria-hidden="true" />
      <Skeleton :class="WIDTHS[(index - 1) % WIDTHS.length]" />
    </div>
  </div>
</template>
