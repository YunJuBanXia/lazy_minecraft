<script setup lang="ts">
import { useTheme } from "../composables/theme";
import type { Lang } from "../types";

defineProps<{ lang: Lang }>();

const { theme, toggle } = useTheme();
</script>

<template>
  <button
    class="ui-control flex h-8 w-8 items-center justify-center rounded-full border hover:border-sky-300"
    :title="
      theme === 'dark'
        ? lang === 'zh'
          ? '切换到浅色模式'
          : 'Switch to light mode'
        : lang === 'zh'
          ? '切换到深色模式'
          : 'Switch to dark mode'
    "
    :aria-label="theme === 'dark' ? 'Light mode' : 'Dark mode'"
    @click="toggle"
  >
    <svg
      v-if="theme === 'dark'"
      viewBox="0 0 24 24"
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
    <svg
      v-else
      viewBox="0 0 24 24"
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  </button>
</template>
