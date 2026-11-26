<script setup lang="ts">
import { guiUrl } from "../data";
import { PANEL_BORDER, PANEL_PADDING } from "../gui";

defineProps<{ scale: number }>();
</script>

<template>
  <article
    class="pixelated flex min-w-0 flex-col gap-3 text-[#404040]"
    :style="{
      borderStyle: 'solid',
      borderWidth: `${PANEL_BORDER * scale}px`,
      borderImage: `url(${guiUrl('panel')}) ${PANEL_BORDER} fill / ${PANEL_BORDER * scale}px stretch`,
      padding: `${PANEL_PADDING * scale}px`,
    }"
  >
    <slot />
  </article>
</template>
