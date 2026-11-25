<script setup lang="ts">
import { computed } from "vue";
import type { Recipe } from "../../shared/types";
import { guiUrl } from "../data";
import { GUI_BACKGROUND, GUI_LAYOUTS, GUI_TEXTURE_SIZE } from "../gui";
import type { Lang, NameMap } from "../types";
import ItemSlot from "./ItemSlot.vue";

const SCALE = 3;

const props = defineProps<{
  recipe: Recipe;
  tags: Record<string, string[]>;
  names: NameMap;
  lang: Lang;
  tick: number;
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
    class="flex flex-col gap-3 rounded-lg border border-zinc-700 bg-zinc-800/60 p-4"
  >
    <header>
      <h2 class="text-base font-semibold">{{ title }}</h2>
    </header>
    <div class="flex flex-1 items-center justify-center py-2">
      <div
        class="relative"
        :style="{
          width: `${layout.width * SCALE}px`,
          height: `${layout.height * SCALE}px`,
          background: GUI_BACKGROUND,
        }"
      >
        <div
          v-for="(sprite, i) in layout.sprites"
          :key="i"
          class="pixelated absolute"
          :style="{
            left: `${sprite.dx * SCALE}px`,
            top: `${sprite.dy * SCALE}px`,
            width: `${sprite.w * SCALE}px`,
            height: `${sprite.h * SCALE}px`,
            backgroundImage: `url(${guiUrl(sprite.texture)})`,
            backgroundSize: `${GUI_TEXTURE_SIZE * SCALE}px`,
            backgroundPosition: `${-sprite.sx * SCALE}px ${-sprite.sy * SCALE}px`,
          }"
        ></div>
        <ItemSlot
          v-for="(input, i) in inputs"
          :key="i"
          :slot="input.slot"
          :x="input.pos.x"
          :y="input.pos.y"
          :scale="SCALE"
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
          :scale="SCALE"
          :tags="tags"
          :names="names"
          :lang="lang"
          :tick="tick"
        />
      </div>
    </div>
    <footer class="flex items-center justify-between text-xs text-zinc-500">
      <span class="rounded bg-zinc-700 px-1.5 py-0.5 text-zinc-200">
        {{ TYPE_LABELS[recipe.type][lang] }}
      </span>
      <span class="truncate pl-2">{{ recipe.id }}</span>
    </footer>
  </article>
</template>
