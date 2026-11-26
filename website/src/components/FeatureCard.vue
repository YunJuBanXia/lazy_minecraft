<script setup lang="ts">
import { computed } from "vue";
import type { Feature, LootCondition } from "../../shared/types";
import { iconUrl } from "../data";
import { GUI_LAYOUTS } from "../gui";
import type { Lang, NameMap } from "../types";
import FishingTable from "./FishingTable.vue";
import GuiFrame from "./GuiFrame.vue";
import ItemSlot from "./ItemSlot.vue";
import McPanel from "./McPanel.vue";

const props = defineProps<{
  feature: Feature;
  tags: Record<string, string[]>;
  names: NameMap;
  lang: Lang;
  tick: number;
  scale: number;
}>();

const CATEGORY_LABELS: Record<Feature["category"], { zh: string; en: string }> =
  {
    fishing: { zh: "钓鱼", en: "Fishing" },
    block_drop: { zh: "方块掉落", en: "Block Drop" },
  };

const TEXT = {
  zh: { requires: "条件", vanillaNone: "原版中不掉落任何物品." },
  en: { requires: "Requires", vanillaNone: "Drops nothing in vanilla." },
};

// 方块掉落借用切石机的 "输入 → 输出" 布局, 左侧为被破坏的方块
const dropLayout = GUI_LAYOUTS.stonecutting;

const fishing = computed(() =>
  props.feature.fishing
    ? { ...props.feature, fishing: props.feature.fishing }
    : undefined,
);

const block = computed(
  () => `minecraft:${props.feature.id.replace(/^blocks\//, "")}`,
);

const drops = computed(() =>
  props.feature.pools.flatMap((pool) =>
    pool.change === "unchanged"
      ? []
      : pool.entries
          .filter((e) => e.current && e.change !== "unchanged")
          .map((entry) => ({
            entry,
            conditions: [...pool.conditions, ...entry.conditions],
          })),
  ),
);

const vanillaDropsNothing = computed(() =>
  props.feature.pools.every((p) => p.change === "added"),
);

function describe(condition: LootCondition): string {
  switch (condition.type) {
    case "enchantment": {
      const name = condition.enchantment[props.lang];
      if (condition.minLevel <= 1) return name;
      return props.lang === "zh"
        ? `${name} ${condition.minLevel} 级及以上`
        : `${name} ${condition.minLevel}+`;
    }
    case "biome":
      return condition.biomes.map((b) => b[props.lang]).join(" / ");
    case "other":
      return condition.condition;
  }
}
</script>

<template>
  <McPanel :scale="scale">
    <header class="flex items-center gap-2">
      <img
        :src="iconUrl(feature.icon)"
        alt=""
        class="pixelated size-8 shrink-0"
        draggable="false"
      />
      <h2 class="text-base font-semibold">{{ feature[lang].title }}</h2>
    </header>
    <div
      class="feature-description text-sm"
      v-html="feature[lang].description"
    />

    <FishingTable
      v-if="fishing"
      :feature="fishing"
      :names="names"
      :lang="lang"
    />
    <div v-else class="flex flex-col items-center gap-2 py-2">
      <div
        v-for="(drop, i) in drops"
        :key="i"
        class="flex flex-col items-center gap-1"
      >
        <GuiFrame :layout="dropLayout" :scale="scale">
          <ItemSlot
            :slot="{ items: [block] }"
            :x="dropLayout.inputs[0].x"
            :y="dropLayout.inputs[0].y"
            :scale="scale"
            :tags="tags"
            :names="names"
            :lang="lang"
            :tick="tick"
          />
          <ItemSlot
            :slot="{ items: [drop.entry.item] }"
            :x="dropLayout.output.x"
            :y="dropLayout.output.y"
            :count="drop.entry.current!.count.max"
            :scale="scale"
            :tags="tags"
            :names="names"
            :lang="lang"
            :tick="tick"
          />
        </GuiFrame>
        <p v-if="drop.conditions.length > 0" class="text-xs">
          {{ TEXT[lang].requires }}:
          {{ drop.conditions.map(describe).join(", ") }}
        </p>
      </div>
      <p v-if="vanillaDropsNothing" class="text-xs text-[#6b6b6b]">
        {{ TEXT[lang].vanillaNone }}
      </p>
    </div>

    <footer class="mt-auto flex items-center justify-between text-xs">
      <span class="shrink-0 font-semibold">{{
        CATEGORY_LABELS[feature.category][lang]
      }}</span>
      <span class="truncate pl-2 text-[#6b6b6b]">{{ feature.id }}</span>
    </footer>
  </McPanel>
</template>
