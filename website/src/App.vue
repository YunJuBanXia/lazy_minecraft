<script setup lang="ts">
import Fuse from "fuse.js";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from "vue";
import type { Recipe, RecipeType } from "../shared/types";
import GithubLink from "./components/GithubLink.vue";
import RecipeCard from "./components/RecipeCard.vue";
import ThemeToggle from "./components/ThemeToggle.vue";
import { useCycleTicker } from "./composables/ticker";
import {
  loadVersion,
  loadVersionIndex,
  recipeItems,
  type LoadedVersion,
} from "./data";
import { cardMinWidth, fitGuiScale, MAX_GUI_SCALE } from "./gui";
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

const content = useTemplateRef("content");
const guiScale = ref(MAX_GUI_SCALE);
const resizeObserver = new ResizeObserver(([entry]) => {
  guiScale.value = fitGuiScale(entry.contentRect.width);
});
onMounted(() => resizeObserver.observe(content.value!));
onBeforeUnmount(() => resizeObserver.disconnect());

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
  <div class="min-h-screen">
    <header class="ui-header sticky top-0 z-30 border-b backdrop-blur">
      <div
        class="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3"
      >
        <h1 class="text-lg font-bold text-zinc-900 dark:text-white">
          Lazy Minecraft
        </h1>
        <input
          v-model="query"
          type="search"
          :placeholder="
            lang === 'zh' ? '搜索物品名称或 ID...' : 'Search items or IDs...'
          "
          class="ui-control min-w-48 flex-1 rounded border px-3 py-1.5 text-sm outline-none focus:border-sky-300"
        />
        <div
          class="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300"
        >
          <!-- 不使用 label 包裹, 否则悬停在文字上会触发下拉框的 :hover -->
          <span>{{ lang === "zh" ? "版本" : "Version" }}</span>
          <select
            v-model="version"
            :aria-label="lang === 'zh' ? '版本' : 'Version'"
            class="ui-button h-[2.125rem] rounded border px-2"
          >
            <!-- Vue 的嵌套校验不认 select 内的 button, 用动态组件绕过 warning, 后续可考虑优化 -->
            <component :is="'button'"
              ><selectedcontent></selectedcontent
            ></component>
            <option v-for="v in versions" :key="v" :value="v">
              {{ v }}
            </option>
          </select>
        </div>
        <button
          class="ui-button rounded border px-3 py-1.5 text-sm hover:border-sky-300"
          @click="lang = lang === 'zh' ? 'en' : 'zh'"
        >
          {{ lang === "zh" ? "中文" : "English" }}
        </button>
        <ThemeToggle :lang="lang" />
        <GithubLink />
      </div>
    </header>

    <div ref="content" class="mx-auto flex max-w-7xl flex-col gap-4 p-4">
      <nav class="flex flex-wrap items-center gap-2 text-sm">
        <button
          v-for="f in TYPE_FILTERS"
          :key="f.value"
          class="rounded-full border px-3 py-1"
          :class="
            typeFilter === f.value
              ? 'border-sky-300 bg-sky-300 text-sky-950'
              : 'ui-button hover:border-sky-300'
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
      <p
        v-else-if="visible.length === 0"
        class="py-12 text-center text-zinc-500"
      >
        {{ lang === "zh" ? "没有匹配的配方" : "No recipes found" }}
      </p>
      <main
        v-else
        class="grid gap-4"
        :style="{
          gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinWidth(guiScale)}px, 1fr))`,
        }"
      >
        <RecipeCard
          v-for="recipe in visible"
          :key="recipe.id"
          :recipe="recipe"
          :tags="loaded!.data.tags"
          :names="loaded!.names"
          :lang="lang"
          :tick="tick"
          :scale="guiScale"
        />
      </main>
    </div>
  </div>
</template>
