import { onBeforeUnmount, onMounted, ref } from "vue";

const CYCLE_INTERVAL_MS = 1500;

/** 全局共享的轮播计数, 所有 tag 槽位同步切换 */
export function useCycleTicker() {
  const tick = ref(0);
  let timer: number | undefined;
  onMounted(() => {
    timer = window.setInterval(() => tick.value++, CYCLE_INTERVAL_MS);
  });
  onBeforeUnmount(() => window.clearInterval(timer));
  return tick;
}
