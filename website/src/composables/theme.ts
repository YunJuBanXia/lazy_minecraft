import { ref, watchEffect } from "vue";

export type Theme = "light" | "dark";

const stored = localStorage.getItem("theme");
const theme = ref<Theme>(
  stored === "light" || stored === "dark"
    ? stored
    : matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
);

watchEffect(() => {
  document.documentElement.classList.toggle("dark", theme.value === "dark");
  localStorage.setItem("theme", theme.value);
});

export function useTheme() {
  const toggle = () => {
    theme.value = theme.value === "dark" ? "light" : "dark";
  };
  return { theme, toggle };
}
