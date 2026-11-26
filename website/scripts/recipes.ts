import path from "node:path";
import type {
  ItemName,
  Recipe,
  RecipeType,
  Slot,
  VersionData,
} from "../shared/types";
import { resolveAlias } from "./aliases";
import { buildFeatures, featureItems } from "./features";
import { itemTagDir, langDir, recipeDir } from "./paths";
import type { Source } from "./source";

const SUPPORTED_TYPES = new Set<string>([
  "crafting_shaped",
  "crafting_shapeless",
  "stonecutting",
]);

const stripNamespace = (id: string) => id.replace(/^minecraft:/, "");
const withNamespace = (id: string) =>
  id.includes(":") ? id : `minecraft:${id}`;

class TagResolver {
  private cache = new Map<string, string[]>();
  readonly used = new Set<string>();

  constructor(private source: Source) {}

  resolve(tag: string, stack: string[] = []): string[] {
    const name = stripNamespace(tag);
    const cached = this.cache.get(name);
    if (cached) return cached;
    if (stack.includes(name)) return [];

    const raw = this.source.read(`${itemTagDir}/${name}.json`);
    if (raw === undefined) {
      console.warn(`[tag] 未找到 tag: #minecraft:${name}`);
      return [];
    }

    const items = new Set<string>();
    const values: unknown[] = JSON.parse(raw).values ?? [];
    for (const value of values) {
      const entry = typeof value === "string" ? value : (value as any).id;
      if (typeof entry !== "string") continue;
      if (entry.startsWith("#")) {
        this.resolve(entry.slice(1), [...stack, name]).forEach((i) =>
          items.add(i),
        );
      } else {
        items.add(withNamespace(entry));
      }
    }

    const result = [...items];
    this.cache.set(name, result);
    return result;
  }
}

function parseIngredient(raw: unknown, tags: TagResolver): Slot | null {
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw)) {
    const items = new Set<string>();
    for (const entry of raw) {
      const slot = parseIngredient(entry, tags);
      if (!slot) continue;
      const members = "tag" in slot ? tags.resolve(slot.tag) : slot.items;
      members.forEach((i) => items.add(i));
    }
    return items.size > 0 ? { items: [...items] } : null;
  }
  if (typeof raw === "object") {
    const obj = raw as { item?: string; tag?: string };
    if (obj.item) return { items: [withNamespace(obj.item)] };
    if (obj.tag) raw = `#${obj.tag}`;
    else return null;
  }
  const text = raw as string;
  if (text.startsWith("#")) {
    const tag = withNamespace(text.slice(1));
    tags.used.add(tag);
    return { tag };
  }
  return { items: [withNamespace(text)] };
}

function parseRecipe(
  id: string,
  json: any,
  tags: TagResolver,
): Recipe | undefined {
  const type = stripNamespace(json.type ?? "");
  if (!SUPPORTED_TYPES.has(type)) {
    console.warn(`[recipe] 跳过不支持的配方类型 ${json.type}: ${id}`);
    return undefined;
  }

  const result = {
    item: withNamespace(json.result.id),
    count: json.result.count ?? 1,
  };
  const base = { id, type: type as RecipeType, result };

  if (type === "crafting_shaped") {
    const pattern: string[] = json.pattern;
    const width = Math.max(...pattern.map((row) => row.length));
    const slots = pattern.flatMap((row) =>
      Array.from({ length: width }, (_, x) => {
        const key = row[x];
        return key === undefined || key === " "
          ? null
          : parseIngredient(json.key[key], tags);
      }),
    );
    return { ...base, width, height: pattern.length, slots };
  }

  if (type === "crafting_shapeless") {
    const slots = (json.ingredients as unknown[]).map((i) =>
      parseIngredient(i, tags),
    );
    const width = Math.min(3, slots.length);
    const height = Math.ceil(slots.length / 3);
    while (slots.length < width * height) slots.push(null);
    return { ...base, width, height, slots };
  }

  return {
    ...base,
    width: 1,
    height: 1,
    slots: [parseIngredient(json.ingredient, tags)],
  };
}

function loadLang(source: Source, name: string): Record<string, string> {
  const raw = source.read(`${langDir}/${name}.json`);
  return raw ? JSON.parse(raw) : {};
}

export function buildVersionData(
  version: string,
  recipeSource: Source,
  resourceSource: Source,
): VersionData {
  const tags = new TagResolver(resourceSource);
  const recipes: Recipe[] = [];
  for (const file of recipeSource.list(recipeDir)) {
    if (!file.endsWith(".json")) continue;
    const id = path.basename(file, ".json");
    const raw = recipeSource.read(`${recipeDir}/${file}`);
    if (raw === undefined) continue;
    const recipe = parseRecipe(id, JSON.parse(raw), tags);
    if (recipe) recipes.push(recipe);
  }

  const zh = loadLang(resourceSource, "zh_cn");
  const en = loadLang(resourceSource, "en_us");
  // 原版战利品表不在仓库中, 旧分支通过 resourceSource 回退到工作区读取
  const features = buildFeatures(recipeSource, resourceSource, (key, id) => ({
    id,
    zh: zh[key] ?? id,
    en: en[key] ?? id,
  }));

  const itemIds = new Set<string>(featureItems(features));
  for (const r of recipes) {
    itemIds.add(r.result.item);
    for (const s of r.slots) {
      if (s && "items" in s) s.items.forEach((i) => itemIds.add(i));
    }
  }
  const tagMembers: Record<string, string[]> = {};
  for (const tag of [...tags.used].sort()) {
    tagMembers[tag] = tags.resolve(tag);
    tagMembers[tag].forEach((i) => itemIds.add(i));
  }

  const lookup = (lang: Record<string, string>, id: string) => {
    const key = stripNamespace(id);
    const alias = stripNamespace(resolveAlias(id));
    return (
      lang[`item.minecraft.${key}`] ??
      lang[`block.minecraft.${key}`] ??
      lang[`item.minecraft.${alias}`] ??
      lang[`block.minecraft.${alias}`] ??
      key
    );
  };
  const items: ItemName[] = [...itemIds].sort().map((id) => ({
    id,
    zh: lookup(zh, id),
    en: lookup(en, id),
  }));

  return { version, recipes, features, items, tags: tagMembers };
}
