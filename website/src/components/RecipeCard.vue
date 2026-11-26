<script setup lang="ts">
import { computed } from "vue";
import type { Recipe } from "../../shared/types";
import { GUI_LAYOUTS } from "../gui";
import type { Lang, NameMap } from "../types";
import GuiFrame from "./GuiFrame.vue";
import ItemSlot from "./ItemSlot.vue";
import McPanel from "./McPanel.vue";

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
  <McPanel :scale="scale">
    <header>
      <h2 class="text-base font-semibold">{{ title }}</h2>
    </header>
    <div class="flex flex-1 items-center justify-center py-2">
      <GuiFrame :layout="layout" :scale="scale">
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
      </GuiFrame>
    </div>
    <footer class="flex items-center justify-between text-xs">
      <span class="shrink-0 font-semibold">{{
        TYPE_LABELS[recipe.type][lang]
      }}</span>
      <span class="truncate pl-2 text-[#6b6b6b]">{{ recipe.id }}</span>
    </footer>
  </McPanel>
</template>
