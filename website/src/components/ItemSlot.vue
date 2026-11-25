<script setup lang="ts">
import { computed, ref } from "vue";
import type { Slot } from "../../shared/types";
import { iconUrl, slotCandidates } from "../data";
import type { Lang, NameMap } from "../types";

const props = defineProps<{
  slot: Slot | null;
  tags: Record<string, string[]>;
  names: NameMap;
  lang: Lang;
  tick: number;
  scale: number;
  x: number;
  y: number;
  count?: number;
}>();

const failed = ref(new Set<string>());

const candidates = computed(() =>
  props.slot ? slotCandidates(props.slot, props.tags) : [],
);
const current = computed(() =>
  candidates.value.length > 0
    ? candidates.value[props.tick % candidates.value.length]
    : undefined,
);

const label = computed(() => {
  if (!current.value) return undefined;
  const name = props.names.get(current.value);
  return {
    name: name?.[props.lang] ?? current.value,
    id: current.value,
  };
});

const tag = computed(() =>
  props.slot && "tag" in props.slot ? props.slot.tag : undefined,
);
const size = computed(() => 16 * props.scale);
</script>

<template>
  <div
    v-if="current"
    class="group absolute hover:z-20"
    :style="{
      left: `${x * scale}px`,
      top: `${y * scale}px`,
      width: `${size}px`,
      height: `${size}px`,
    }"
  >
    <img
      v-if="!failed.has(current)"
      :src="iconUrl(current)"
      :alt="label?.name"
      class="pixelated h-full w-full select-none"
      draggable="false"
      @error="failed.add(current)"
    />
    <div
      v-else
      class="flex h-full w-full items-center justify-center bg-zinc-500/60 font-mc text-white"
      :style="{ fontSize: `${size * 0.6}px` }"
    >
      ?
    </div>
    <div
      v-if="count && count > 1"
      class="font-mc pointer-events-none absolute right-0 bottom-0 leading-none font-bold text-white"
      :style="{
        fontSize: `${scale * 8}px`,
        textShadow: `${scale}px ${scale}px 0 #3f3f3f`,
      }"
    >
      {{ count }}
    </div>
    <div
      class="pointer-events-none absolute inset-0 hidden bg-white/40 group-hover:block"
    ></div>
    <div
      v-if="label"
      class="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden w-max max-w-64 -translate-x-1/2 rounded border border-sky-300/70 bg-zinc-950/95 px-2 py-1 text-xs shadow-lg group-hover:block"
    >
      <div class="text-sm font-semibold text-zinc-50">
        {{ label.name }}
      </div>
      <div class="text-zinc-500">{{ label.id }}</div>
      <div v-if="tag" class="mt-0.5 text-amber-300">
        #{{ tag }} ({{ candidates.length }})
      </div>
    </div>
  </div>
</template>
