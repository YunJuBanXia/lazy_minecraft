<script setup lang="ts">
import Fuse from "fuse.js";
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import type { Recipe, RecipeType } from "../shared/types";
import RecipeCard from "./components/RecipeCard.vue";
import { useCycleTicker } from "./composables/ticker";
import {
  loadVersion,
  loadVersionIndex,
  recipeItems,
  type LoadedVersion,
} from "./data";
import type { Lang } from "./types";

interface SearchEntry {
  recipe: Recipe;
  result: string[];
  ingredients: string[];
  id: string;
}

const tick = useCycleTicker();

const versions = ref<string[]>([]);
const version = ref("");
const lang = ref<Lang>((localStorage.getItem("lang") as Lang | null) ?? "zh");
const typeFilter = ref<RecipeType | "all">("all");
const query = ref("");
const loaded = shallowRef<LoadedVersion>();
const error = ref("");

const TYPE_FILTERS: { value: RecipeType | "all"; zh: string; en: string }[] = [
  { value: "all", zh: "全部", en: "All" },
  { value: "crafting_shaped", zh: "有序合成", en: "Shaped" },
  { value: "crafting_shapeless", zh: "无序合成", en: "Shapeless" },
  { value: "stonecutting", zh: "切石机", en: "Stonecutting" },
];

onMounted(async () => {
  try {
    const index = await loadVersionIndex();
    versions.value = index.versions;
    const saved = localStorage.getItem("version");
    version.value =
      saved && index.versions.includes(saved) ? saved : index.default;
  } catch (e) {
    error.value = String(e);
  }
});

watch(version, async (v) => {
  if (!v) return;
  localStorage.setItem("version", v);
  try {
    loaded.value = await loadVersion(v);
    error.value = "";
  } catch (e) {
    error.value = String(e);
  }
});

watch(lang, (l) => localStorage.setItem("lang", l));

const fuse = computed(() => {
  if (!loaded.value) return undefined;
  const { data, names } = loaded.value;
  const nameParts = (id: string) => {
    const n = names.get(id);
    return n ? [id, n.zh, n.en] : [id];
  };
  const entries: SearchEntry[] = data.recipes.map((recipe) => ({
    recipe,
    id: recipe.id,
    result: nameParts(recipe.result.item),
    ingredients: recipeItems(recipe, data.tags).flatMap(nameParts),
  }));
  return new Fuse(entries, {
    keys: [
      { name: "result", weight: 3 },
      { name: "ingredients", weight: 1 },
      { name: "id", weight: 1 },
    ],
    threshold: 0.3,
    ignoreLocation: true,
  });
});

const visible = computed(() => {
  if (!loaded.value || !fuse.value) return [];
  const text = query.value.trim();
  const recipes = text
    ? fuse.value.search(text).map((r) => r.item.recipe)
    : loaded.value.data.recipes;
  return typeFilter.value === "all"
    ? recipes
    : recipes.filter((r) => r.type === typeFilter.value);
});
</script>

<template>
  <div class="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-4">
    <header
      class="sticky top-0 z-30 -mx-4 flex flex-wrap items-center gap-3 border-b border-zinc-700 bg-zinc-900/95 px-4 py-3 backdrop-blur"
    >
      <h1 class="text-lg font-bold text-amber-400">lazy_minecraft</h1>
      <input
        v-model="query"
        type="search"
        :placeholder="
          lang === 'zh' ? '搜索物品名称或 ID...' : 'Search items or IDs...'
        "
        class="min-w-48 flex-1 rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm outline-none focus:border-violet-500"
      />
      <label class="flex items-center gap-1.5 text-sm text-zinc-300">
        {{ lang === "zh" ? "版本" : "Version" }}
        <select
          v-model="version"
          class="rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5"
        >
          <option v-for="v in versions" :key="v" :value="v">JE {{ v }}</option>
        </select>
      </label>
      <button
        class="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm hover:border-violet-500"
        @click="lang = lang === 'zh' ? 'en' : 'zh'"
      >
        {{ lang === "zh" ? "中文" : "English" }}
      </button>
    </header>

    <nav class="flex flex-wrap items-center gap-2 text-sm">
      <button
        v-for="f in TYPE_FILTERS"
        :key="f.value"
        class="rounded-full border px-3 py-1"
        :class="
          typeFilter === f.value
            ? 'border-violet-500 bg-violet-600 text-white'
            : 'border-zinc-600 bg-zinc-800 text-zinc-300 hover:border-violet-500'
        "
        @click="typeFilter = f.value"
      >
        {{ f[lang] }}
      </button>
      <span class="ml-auto text-zinc-500">
        {{ visible.length }} {{ lang === "zh" ? "个配方" : "recipes" }}
      </span>
    </nav>

    <p v-if="error" class="text-red-400">{{ error }}</p>
    <p v-else-if="!loaded" class="text-zinc-400">Loading...</p>
    <p v-else-if="visible.length === 0" class="py-12 text-center text-zinc-500">
      {{ lang === "zh" ? "没有匹配的配方" : "No recipes found" }}
    </p>
    <main
      v-else
      class="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4"
    >
      <RecipeCard
        v-for="recipe in visible"
        :key="recipe.id"
        :recipe="recipe"
        :tags="loaded!.data.tags"
        :names="loaded!.names"
        :lang="lang"
        :tick="tick"
      />
    </main>
  </div>
</template>
