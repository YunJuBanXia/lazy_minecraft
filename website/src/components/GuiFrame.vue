<script setup lang="ts">
import { guiUrl } from "../data";
import { GUI_TEXTURE_SIZE, type GuiLayout } from "../gui";

defineProps<{ layout: GuiLayout; scale: number }>();
</script>

<template>
  <div
    class="relative"
    :style="{
      width: `${layout.width * scale}px`,
      height: `${layout.height * scale}px`,
    }"
  >
    <div
      v-for="(sprite, i) in layout.sprites"
      :key="i"
      class="pixelated absolute"
      :style="{
        left: `${sprite.dx * scale}px`,
        top: `${sprite.dy * scale}px`,
        width: `${sprite.w * scale}px`,
        height: `${sprite.h * scale}px`,
        backgroundImage: `url(${guiUrl(sprite.texture)})`,
        backgroundSize: `${GUI_TEXTURE_SIZE * scale}px`,
        backgroundPosition: `${-sprite.sx * scale}px ${-sprite.sy * scale}px`,
      }"
    ></div>
    <slot />
  </div>
</template>
