import { onBeforeUnmount, ref, watch } from "vue";

export type Page = "recipes" | "features";

const PAGES: Page[] = ["recipes", "features"];

function fromHash(): Page {
  const hash = location.hash.slice(1);
  return PAGES.includes(hash as Page) ? (hash as Page) : "recipes";
}

/** 当前页面与 URL hash 双向同步, 刷新或分享链接时保留所在页面 */
export function usePage() {
  const page = ref<Page>(fromHash());
  const onHashChange = () => (page.value = fromHash());
  window.addEventListener("hashchange", onHashChange);
  onBeforeUnmount(() => window.removeEventListener("hashchange", onHashChange));
  watch(page, (p) => {
    if (fromHash() !== p) location.hash = p;
  });
  return page;
}
