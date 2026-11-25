import type {
  ItemName,
  Recipe,
  Slot,
  VersionData,
  VersionIndex,
} from "../shared/types";

const base = `${import.meta.env.BASE_URL}generated/`;

export const iconUrl = (id: string) =>
  `${base}icons/${id.replace(/^minecraft:/, "")}.png`;

export const guiUrl = (texture: string) => `${base}gui/${texture}.png`;

export async function loadVersionIndex(): Promise<VersionIndex> {
  const res = await fetch(`${base}data/versions.json`);
  return res.json();
}

export interface LoadedVersion {
  data: VersionData;
  names: Map<string, ItemName>;
}

export async function loadVersion(version: string): Promise<LoadedVersion> {
  const res = await fetch(`${base}data/${version}/recipes.json`);
  const data: VersionData = await res.json();
  return { data, names: new Map(data.items.map((i) => [i.id, i])) };
}

export function slotCandidates(
  slot: Slot,
  tags: Record<string, string[]>,
): string[] {
  return "tag" in slot ? (tags[slot.tag] ?? []) : slot.items;
}

export function recipeItems(recipe: Recipe, tags: Record<string, string[]>) {
  const ids = new Set<string>([recipe.result.item]);
  for (const slot of recipe.slots) {
    if (slot) slotCandidates(slot, tags).forEach((i) => ids.add(i));
  }
  return [...ids];
}
