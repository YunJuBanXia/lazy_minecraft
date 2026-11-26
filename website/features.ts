import type { FeatureCategory } from "./shared/types";

export interface FeatureMeta {
  category: FeatureCategory;
  /** 代表该特性的物品, 用作卡片图标 */
  icon: string;
  /** description 支持 Markdown */
  zh: { title: string; description: string };
  en: { title: string; description: string };
}

/**
 * 特性的展示信息, key 为 `src/data/minecraft/loot_table` 下的战利品表路径(不含扩展名).
 * 数据包覆盖了某个战利品表却没有在此登记时构建会失败
 */
export const FEATURES: Record<string, FeatureMeta> = {
  "gameplay/fishing/junk": {
    category: "fishing",
    icon: "minecraft:elytra",
    zh: {
      title: "钓鱼: 垃圾",
      description:
        "钓到垃圾时有概率获得**鞘翅**和**湿海绵**, 其中湿海绵取代了原版的腐肉.",
    },
    en: {
      title: "Fishing: Junk",
      description:
        "Junk catches may include **Elytra** and **Wet Sponges**, with Wet Sponges replacing vanilla Rotten Flesh.",
    },
  },
  "gameplay/fishing/treasure": {
    category: "fishing",
    icon: "minecraft:heart_of_the_sea",
    zh: {
      title: "钓鱼: 宝藏",
      description: "钓到宝藏时有概率获得**海洋之心**.",
    },
    en: {
      title: "Fishing: Treasure",
      description: "Treasure catches may include the **Heart of the Sea**.",
    },
  },
  "blocks/budding_amethyst": {
    category: "block_drop",
    icon: "minecraft:budding_amethyst",
    zh: {
      title: "紫水晶母岩",
      description: "使用带有**精准采集**的镐挖掘紫水晶母岩时会掉落其本身.",
    },
    en: {
      title: "Budding Amethyst",
      description:
        "Budding Amethyst drops itself when mined with a **Silk Touch** pickaxe.",
    },
  },
};
