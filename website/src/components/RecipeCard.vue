<script setup lang="ts">
import { computed } from "vue";
import type { Recipe } from "../../shared/types";
import { guiUrl } from "../data";
import {
  GUI_LAYOUTS,
  GUI_TEXTURE_SIZE,
  PANEL_BORDER,
  PANEL_PADDING,
} from "../gui";
import type { Lang, NameMap } from "../types";
import ItemSlot from "./ItemSlot.vue";

const props = defineProps<{
  recipe: Recipe;
  tags: Record<string, string[]>;
  names: NameMap;
  lang: Lang;
  tick: number;
  scale: number;
}>();

const TYPE_LABELS: Record<Recipe["type"], { zh: string; en: string }> = {
  crafting_shaped: { zh: "有序合成", en: "Shaped" },
  crafting_shapeless: { zh: "无序合成", en: "Shapeless" },
  stonecutting: { zh: "切石机", en: "Stonecutting" },
};

const layout = computed(() => GUI_LAYOUTS[props.recipe.type]);

const inputs = computed(() =>
  props.recipe.slots.map((slot, i) => {
    const col = i % props.recipe.width;
    const row = Math.floor(i / props.recipe.width);
    return {
      slot,
      pos: layout.value.inputs[row * layout.value.gridWidth + col],
    };
  }),
);

const title = computed(() => {
  const name = props.names.get(props.recipe.result.item);
  return name?.[props.lang] ?? props.recipe.result.item;
});
</script>

<template>
  <article
    class="pixelated flex flex-col gap-3 text-[#404040]"
    :style="{
      borderStyle: 'solid',
      borderWidth: `${PANEL_BORDER * scale}px`,
      borderImage: `url(${guiUrl('panel')}) ${PANEL_BORDER} fill / ${PANEL_BORDER * scale}px stretch`,
      padding: `${PANEL_PADDING * scale}px`,
    }"
  >
    <header>
      <h2 class="text-base font-semibold">{{ title }}</h2>
    </header>
    <div class="flex flex-1 items-center justify-center py-2">
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
        <ItemSlot
          v-for="(input, i) in inputs"
          :key="i"
          :slot="input.slot"
          :x="input.pos.x"
          :y="input.pos.y"
          :scale="scale"
          :tags="tags"
          :names="names"
          :lang="lang"
          :tick="tick"
        />
        <ItemSlot
          :slot="{ items: [recipe.result.item] }"
          :x="layout.output.x"
          :y="layout.output.y"
          :count="recipe.result.count"
          :scale="scale"
          :tags="tags"
          :names="names"
          :lang="lang"
          :tick="tick"
        />
      </div>
    </div>
    <footer class="flex items-center justify-between text-xs">
      <span class="shrink-0 font-semibold">{{
        TYPE_LABELS[recipe.type][lang]
      }}</span>
      <span class="truncate pl-2 text-[#6b6b6b]">{{ recipe.id }}</span>
    </footer>
  </article>
</template>
