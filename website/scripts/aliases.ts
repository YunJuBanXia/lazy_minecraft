/** 旧版本中被重命名的物品, 用新版资源包中的对应物品查找贴图和名称 */
const LEGACY_ITEM_ALIASES: Record<string, string> = {
  "minecraft:chain": "minecraft:iron_chain",
};

export const resolveAlias = (id: string) => LEGACY_ITEM_ALIASES[id] ?? id;
