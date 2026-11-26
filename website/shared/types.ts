export type RecipeType =
  "crafting_shaped" | "crafting_shapeless" | "stonecutting";

/** 具体物品列表与 tag 二选一, 候选多于一个时前端轮播 */
export type Slot =
  | { items: string[] }
  | {
      /** 形如 `minecraft:logs`, 不含 `#`, 展开结果见 VersionData.tags */
      tag: string;
    };

export interface Recipe {
  /** 配方文件名(不含扩展名) */
  id: string;
  type: RecipeType;
  width: number;
  height: number;
  /** 按行优先排列, 长度为 width * height, 空槽位为 null */
  slots: (Slot | null)[];
  result: { item: string; count: number };
}

export interface ItemName {
  id: string;
  zh: string;
  en: string;
}

export interface VersionData {
  version: string;
  recipes: Recipe[];
  features: Feature[];
  items: ItemName[];
  /** 已递归展开的 tag 成员 */
  tags: Record<string, string[]>;
}

export interface VersionIndex {
  default: string;
  versions: string[];
}

export type FeatureCategory = "fishing" | "block_drop";

/** 与原版同名战利品表对比的结果 */
export type LootChange = "added" | "modified" | "removed" | "unchanged";

export interface LocalizedName {
  id: string;
  zh: string;
  en: string;
}

export type LootCondition =
  | { type: "biome"; biomes: LocalizedName[] }
  | { type: "enchantment"; enchantment: LocalizedName; minLevel: number }
  /** 尚未支持解析的条件, 仅展示条件类型 */
  | { type: "other"; condition: string };

export interface LootStats {
  weight: number;
  count: { min: number; max: number };
}

export interface LootEntry {
  item: string;
  change: LootChange;
  conditions: LootCondition[];
  /** 数据包中的数值, 被删除的条目没有该字段 */
  current?: LootStats;
  /** 原版中的数值, 新增的条目没有该字段 */
  vanilla?: LootStats;
  /** 仅钓鱼类特性: 与 FishingOdds.columns 一一对应的钓到该物品的概率 */
  chances?: number[];
  vanillaChances?: number[];
}

export interface LootPool {
  change: LootChange;
  conditions: LootCondition[];
  entries: LootEntry[];
}

export interface FishingOdds {
  /** 池中存在生物群系条件时, 每个海之眷顾等级再按是否位于这些群系分为两列 */
  biomes?: LocalizedName[];
  columns: { luck: number; inBiome?: boolean }[];
}

export interface FeatureText {
  title: string;
  /** 已由 Markdown 渲染为 HTML */
  description: string;
}

export interface Feature {
  /** 战利品表路径, 如 `gameplay/fishing/junk` */
  id: string;
  category: FeatureCategory;
  /** 代表该特性的物品, 用作卡片图标 */
  icon: string;
  zh: FeatureText;
  en: FeatureText;
  pools: LootPool[];
  fishing?: FishingOdds;
}
