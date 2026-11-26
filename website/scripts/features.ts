import { marked } from "marked";
import { FEATURES, type FeatureMeta } from "../features";
import type {
  Feature,
  FeatureText,
  FishingOdds,
  LocalizedName,
  LootChange,
  LootCondition,
  LootEntry,
  LootPool,
  LootStats,
} from "../shared/types";
import { lootTableDir, vanillaLootTableDir } from "./paths";
import type { Source } from "./source";

export type Translate = (key: string, id: string) => LocalizedName;

const LUCK_OF_THE_SEA_LEVELS = [0, 1, 2, 3];
const FISHING_TABLE = "gameplay/fishing";

const withNamespace = (id: string) =>
  id.includes(":") ? id : `minecraft:${id}`;

/** 键排序后序列化, 用于判断条目是否与原版一致 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function listTables(source: Source, dir: string, prefix = ""): string[] {
  return source.list(prefix ? `${dir}/${prefix}` : dir).flatMap((name) => {
    const rel = prefix ? `${prefix}/${name}` : name;
    return name.endsWith(".json")
      ? [rel.slice(0, -".json".length)]
      : listTables(source, dir, rel);
  });
}

class Tables {
  constructor(
    private datapack: Source,
    private vanilla: Source,
  ) {}

  private read(source: Source, dir: string, id: string): any {
    const raw = source.read(`${dir}/${id}.json`);
    return raw === undefined ? undefined : JSON.parse(raw);
  }

  original(id: string): any {
    return this.read(this.vanilla, vanillaLootTableDir, id);
  }

  /** 数据包覆盖时取数据包版本, 否则取原版 */
  effective(id: string): any {
    return this.read(this.datapack, lootTableDir, id) ?? this.original(id);
  }
}

function asList(value: unknown): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

function parseConditions(raw: any[] = [], t: Translate): LootCondition[] {
  return raw.flatMap((c): LootCondition[] => {
    const type = withNamespace(c.condition ?? "");
    if (type === "minecraft:location_check" && c.predicate?.biomes) {
      const biomes = asList(c.predicate.biomes).map((b) =>
        b.startsWith("#")
          ? { id: b, zh: b, en: b }
          : t(`biome.minecraft.${b.replace(/^minecraft:/, "")}`, b),
      );
      return [{ type: "biome", biomes }];
    }
    const enchantments = c.predicate?.predicates?.["minecraft:enchantments"];
    if (type === "minecraft:match_tool" && Array.isArray(enchantments)) {
      return enchantments.flatMap((e: any) =>
        asList(e.enchantments).map((id) => ({
          type: "enchantment" as const,
          enchantment: t(
            `enchantment.minecraft.${id.replace(/^minecraft:/, "")}`,
            id,
          ),
          minLevel: e.levels?.min ?? 1,
        })),
      );
    }
    return [{ type: "other", condition: type }];
  });
}

function parseCount(functions: any[] = []): LootStats["count"] {
  const fn = functions.find(
    (f) => withNamespace(f.function) === "minecraft:set_count",
  );
  const count = fn?.count;
  if (typeof count === "number") return { min: count, max: count };
  if (count && typeof count === "object") {
    if (typeof count.value === "number") {
      return { min: count.value, max: count.value };
    }
    if (typeof count.min === "number" && typeof count.max === "number") {
      return { min: count.min, max: count.max };
    }
  }
  return { min: 1, max: 1 };
}

interface ParsedEntry {
  item: string;
  conditions: LootCondition[];
  stats: LootStats;
  raw: string;
}

function parseEntries(pool: any, tableId: string, t: Translate) {
  if (!pool) return [];
  const entries: any[] = (pool.entries ?? []).filter((e: any) => {
    if (withNamespace(e.type ?? "") === "minecraft:item") return true;
    console.warn(`[feature] ${tableId}: 跳过不支持的条目类型 ${e.type}`);
    return false;
  });
  return entries.map((e): ParsedEntry => ({
    item: withNamespace(e.name),
    conditions: parseConditions(e.conditions, t),
    stats: { weight: e.weight ?? 1, count: parseCount(e.functions) },
    raw: stableStringify(e),
  }));
}

const poolShell = ({ entries: _, ...rest }: any) => stableStringify(rest);

function comparePool(
  pool: any,
  vanillaPool: any,
  tableId: string,
  t: Translate,
): LootPool {
  const current = parseEntries(pool, tableId, t);
  const vanilla = parseEntries(vanillaPool, tableId, t);
  const vanillaByItem = new Map(vanilla.map((e) => [e.item, e]));
  const currentItems = new Set(current.map((e) => e.item));

  const entries: LootEntry[] = current.map((e) => {
    const v = vanillaByItem.get(e.item);
    return {
      item: e.item,
      change: !v ? "added" : v.raw === e.raw ? "unchanged" : "modified",
      conditions: e.conditions,
      current: e.stats,
      vanilla: v?.stats,
    };
  });
  for (const v of vanilla) {
    if (currentItems.has(v.item)) continue;
    entries.push({
      item: v.item,
      change: "removed",
      conditions: v.conditions,
      vanilla: v.stats,
    });
  }

  const change: LootChange = !vanillaPool
    ? "added"
    : !pool
      ? "removed"
      : poolShell(pool) === poolShell(vanillaPool) &&
          entries.every((e) => e.change === "unchanged")
        ? "unchanged"
        : "modified";
  return {
    change,
    conditions: parseConditions((pool ?? vanillaPool).conditions, t),
    entries,
  };
}

/**
 * 钓鱼时先按 `gameplay/fishing` 选出类别(鱼, 垃圾, 宝藏), 有效权重为
 * `max(floor(weight + quality * luck), 0)`, 其中 luck 为海之眷顾等级.
 * 宝藏类别的开阔水域条件视为满足
 */
function categoryChances(fishing: any, tableId: string): number[] {
  const entries: any[] = fishing?.pools?.[0]?.entries ?? [];
  const target = withNamespace(tableId);
  if (!entries.some((e) => e.value === target)) {
    throw new Error(`[feature] ${FISHING_TABLE} 中没有引用 ${tableId}`);
  }
  return LUCK_OF_THE_SEA_LEVELS.map((luck) => {
    const weight = (e: any) =>
      Math.max(Math.floor((e.weight ?? 1) + (e.quality ?? 0) * luck), 0);
    const total = entries.reduce((sum, e) => sum + weight(e), 0);
    const own = entries.find((e) => e.value === target);
    return weight(own) / total;
  });
}

/** 带生物群系条件的条目仅在 inBiome 时参与抽取, 带其他条件的条目视为不满足 */
function poolChances(
  entries: ParsedEntry[],
  categories: number[],
  columns: FishingOdds["columns"],
): number[][] {
  const active = (e: ParsedEntry, inBiome: boolean) =>
    e.conditions.every((c) => inBiome && c.type === "biome");
  return entries.map((entry) =>
    columns.map(({ luck, inBiome = false }) => {
      if (!active(entry, inBiome)) return 0;
      const total = entries
        .filter((e) => active(e, inBiome))
        .reduce((sum, e) => sum + e.stats.weight, 0);
      const category = categories[LUCK_OF_THE_SEA_LEVELS.indexOf(luck)];
      return (category * entry.stats.weight) / total;
    }),
  );
}

function buildFishingOdds(
  id: string,
  tables: Tables,
  pools: LootPool[],
  t: Translate,
): FishingOdds {
  const current = parseEntries(tables.effective(id)?.pools?.[0], id, t);
  const vanilla = parseEntries(tables.original(id)?.pools?.[0], id, t);
  if ((tables.effective(id)?.pools?.length ?? 0) > 1) {
    console.warn(`[feature] ${id}: 钓鱼概率只统计第一个池`);
  }

  const biomeSets = new Map<string, LocalizedName[]>();
  for (const e of [...current, ...vanilla]) {
    for (const c of e.conditions) {
      if (c.type === "biome") {
        biomeSets.set(c.biomes.map((b) => b.id).join(","), c.biomes);
      }
    }
  }
  if (biomeSets.size > 1) {
    console.warn(`[feature] ${id}: 存在多组生物群系条件, 表格只区分是否满足`);
  }
  const biomes = [...biomeSets.values()][0];
  const columns = LUCK_OF_THE_SEA_LEVELS.flatMap((luck) =>
    biomes ? [false, true].map((inBiome) => ({ luck, inBiome })) : [{ luck }],
  );

  const fill = (
    entries: ParsedEntry[],
    fishing: any,
    key: "chances" | "vanillaChances",
  ) => {
    const chances = poolChances(entries, categoryChances(fishing, id), columns);
    const byItem = new Map(entries.map((e, i) => [e.item, chances[i]]));
    for (const entry of pools[0]?.entries ?? []) {
      const c = byItem.get(entry.item);
      if (c) entry[key] = c;
    }
  };
  fill(current, tables.effective(FISHING_TABLE), "chances");
  fill(vanilla, tables.original(FISHING_TABLE), "vanillaChances");

  return { biomes, columns };
}

function renderText(text: FeatureMeta["zh"]): FeatureText {
  return {
    title: text.title,
    description: marked.parse(text.description, { async: false }),
  };
}

export function buildFeatures(
  datapack: Source,
  vanilla: Source,
  t: Translate,
): Feature[] {
  const ids = listTables(datapack, lootTableDir);
  const missing = ids.filter((id) => !(id in FEATURES));
  if (missing.length > 0) {
    throw new Error(
      `[feature] 以下战利品表未在 website/features.ts 中登记: ${missing.join(", ")}`,
    );
  }

  const tables = new Tables(datapack, vanilla);
  return ids.map((id) => {
    const meta = FEATURES[id];
    const original = tables.original(id);
    if (!original) {
      console.warn(`[feature] ${id}: 原版中没有该战利品表, 所有条目视为新增`);
    }
    const pools: any[] = tables.effective(id).pools ?? [];
    const vanillaPools: any[] = original?.pools ?? [];
    const lootPools = Array.from(
      { length: Math.max(pools.length, vanillaPools.length) },
      (_, i) => comparePool(pools[i], vanillaPools[i], id, t),
    );
    return {
      id,
      category: meta.category,
      icon: meta.icon,
      zh: renderText(meta.zh),
      en: renderText(meta.en),
      pools: lootPools,
      fishing:
        meta.category === "fishing"
          ? buildFishingOdds(id, tables, lootPools, t)
          : undefined,
    };
  });
}

export function featureItems(features: Feature[]): string[] {
  return features.flatMap((f) => [
    f.icon,
    ...f.pools.flatMap((p) => p.entries.map((e) => e.item)),
  ]);
}
