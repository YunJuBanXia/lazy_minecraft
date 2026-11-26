<script setup lang="ts">
import { computed } from "vue";
import type { Feature, LootChange, LootEntry } from "../../shared/types";
import { iconUrl } from "../data";
import type { Lang, NameMap } from "../types";

const props = defineProps<{
  feature: Feature & { fishing: NonNullable<Feature["fishing"]> };
  names: NameMap;
  lang: Lang;
}>();

const ROMAN = ["0", "I", "II", "III", "IV", "V"];

const TEXT = {
  zh: {
    item: "物品",
    luck: "海之眷顾",
    other: "其他",
    was: "原",
    note: "每次钓鱼钓到该物品的概率, 按开阔水域计算, 未计入幸运效果.",
    biomes: "生物群系",
  },
  en: {
    item: "Item",
    luck: "Luck of the Sea",
    other: "Other",
    was: "was",
    note: "Chance per catch, assuming open water and no Luck effect.",
    biomes: "Biomes",
  },
};

const CHANGE_LABELS: Record<
  Exclude<LootChange, "unchanged">,
  { zh: string; en: string; badge: string; row: string }
> = {
  added: {
    zh: "新增",
    en: "New",
    badge: "bg-[#3f7d2b] text-white",
    row: "bg-[#b5d3a4]",
  },
  modified: {
    zh: "修改",
    en: "Changed",
    badge: "bg-[#9a6b12] text-white",
    row: "bg-[#ddcb98]",
  },
  removed: {
    zh: "移除",
    en: "Removed",
    badge: "bg-[#8c2f2f] text-white",
    row: "bg-[#d4aaaa]",
  },
};

const text = computed(() => TEXT[props.lang]);
const odds = computed(() => props.feature.fishing);
const entries = computed(() => props.feature.pools[0]?.entries ?? []);
const levels = computed(() => [
  ...new Set(odds.value.columns.map((c) => c.luck)),
]);
const biomeLabel = computed(() => odds.value.biomes?.[0]?.[props.lang] ?? "");

const name = (id: string) => props.names.get(id)?.[props.lang] ?? id;

const percent = (value: number) =>
  value === 0 ? "-" : `${(value * 100).toFixed(2)}%`;

const countLabel = (entry: LootEntry) => {
  const count = (entry.current ?? entry.vanilla)!.count;
  if (count.min === 1 && count.max === 1) return "";
  return count.min === count.max
    ? `×${count.min}`
    : `×${count.min}-${count.max}`;
};

function cells(entry: LootEntry) {
  return odds.value.columns.map((_, i) => {
    const current = entry.chances?.[i];
    const vanilla = entry.vanillaChances?.[i];
    if (current === undefined) {
      return { value: percent(vanilla ?? 0), was: undefined };
    }
    const changed = vanilla !== undefined && Math.abs(current - vanilla) > 1e-9;
    return {
      value: percent(current),
      was: changed ? percent(vanilla) : undefined,
    };
  });
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="overflow-x-auto">
      <table
        class="w-full border-collapse text-center text-xs whitespace-nowrap tabular-nums"
      >
        <thead class="bg-[#b0b0b0]">
          <tr>
            <th
              :rowspan="odds.biomes ? 3 : 2"
              class="sticky left-0 z-10 border shadow-[1px_0_0_#8b8b8b] border-[#8b8b8b] bg-[#b0b0b0] px-2 py-1 text-left"
            >
              {{ text.item }}
            </th>
            <th
              :colspan="odds.columns.length"
              class="border border-[#8b8b8b] px-2 py-1"
            >
              {{ text.luck }}
            </th>
          </tr>
          <tr>
            <th
              v-for="level in levels"
              :key="level"
              :colspan="odds.biomes ? 2 : 1"
              class="border border-[#8b8b8b] px-2 py-1"
            >
              {{ ROMAN[level] }}
            </th>
          </tr>
          <tr v-if="odds.biomes">
            <template v-for="level in levels" :key="level">
              <th class="border border-[#8b8b8b] px-2 py-1 font-normal">
                {{ text.other }}
              </th>
              <th class="border border-[#8b8b8b] px-2 py-1 font-normal">
                {{ biomeLabel }}*
              </th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in entries"
            :key="entry.item"
            :class="
              entry.change === 'unchanged'
                ? 'bg-[#c6c6c6]'
                : CHANGE_LABELS[entry.change].row
            "
          >
            <!-- 横向滚动时固定物品列, 背景继承行背景以遮住滚动内容 -->
            <td
              class="sticky left-0 z-10 border shadow-[1px_0_0_#8b8b8b] border-[#8b8b8b] bg-inherit px-2 py-1 text-left"
            >
              <div
                class="flex items-center gap-2"
                :class="entry.change === 'removed' && 'opacity-60'"
              >
                <img
                  :src="iconUrl(entry.item)"
                  :alt="name(entry.item)"
                  class="pixelated size-6 shrink-0"
                  draggable="false"
                />
                <span :class="entry.change === 'removed' && 'line-through'">
                  {{ name(entry.item) }}
                </span>
                <span v-if="countLabel(entry)" class="text-[#6b6b6b]">
                  {{ countLabel(entry) }}
                </span>
                <span
                  v-if="entry.change !== 'unchanged'"
                  class="ml-auto rounded-sm px-1 text-[10px] leading-4"
                  :class="CHANGE_LABELS[entry.change].badge"
                >
                  {{ CHANGE_LABELS[entry.change][lang] }}
                </span>
              </div>
            </td>
            <td
              v-for="(cell, i) in cells(entry)"
              :key="i"
              class="border border-[#8b8b8b] px-2 py-1"
              :class="entry.change === 'removed' && 'line-through opacity-60'"
            >
              <div>{{ cell.value }}</div>
              <div v-if="cell.was" class="text-[10px] text-[#6b6b6b]">
                {{ text.was }} {{ cell.was }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-xs text-[#6b6b6b]">
      {{ text.note }}
      <template v-if="odds.biomes">
        <br />
        * {{ text.biomes }}:
        {{ odds.biomes.map((b) => b[lang]).join(", ") }}
      </template>
    </p>
  </div>
</template>
