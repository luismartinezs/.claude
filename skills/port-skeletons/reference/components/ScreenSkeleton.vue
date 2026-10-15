<script setup lang="ts">
import Skeleton from "./Skeleton.vue"
import SkeletonRows from "./SkeletonRows.vue"

/**
 * The content area before its screen can draw: while the session is checked
 * and while the screen's code is fetched. It has the grammar every main
 * screen shares (a title at wide widths, then a panel of rows), so the screen
 * that replaces it lands where this stood.
 */
</script>

<template>
  <div aria-busy="true" data-testid="screen-skeleton">
    <span class="sr-only">Loading</span>
    <div class="mb-6 hidden lg:block">
      <p class="t-screen"><Skeleton class="h-7 w-40" /></p>
      <p class="t-label"><Skeleton class="h-3 w-28" /></p>
    </div>
    <section class="panel">
      <header class="panel-head"><Skeleton class="w-24" /></header>
      <SkeletonRows :count="5" />
    </section>
  </div>
</template>
