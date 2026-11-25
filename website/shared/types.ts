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
  items: ItemName[];
  /** 已递归展开的 tag 成员 */
  tags: Record<string, string[]>;
}

export interface VersionIndex {
  default: string;
  versions: string[];
}
