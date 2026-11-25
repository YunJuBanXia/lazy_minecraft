import { fileURLToPath } from "node:url";
import path from "node:path";

export const websiteDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const repoRoot = path.resolve(websiteDir, "..");
export const assetsDir = path.join(repoRoot, "assets", "minecraft");
export const generatedDir = path.join(websiteDir, "public", "generated");

export const recipeDir = "src/data/lazy_minecraft/recipe";
export const itemTagDir = "data/minecraft/tags/item";
export const langDir = "assets/minecraft/lang";
