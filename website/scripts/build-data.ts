import fs from "node:fs";
import path from "node:path";
import type { VersionData, VersionIndex } from "../shared/types";
import { generateIcons } from "./icons";
import { assetsDir, generatedDir, websiteDir } from "./paths";
import { buildVersionData } from "./recipes";
import {
  currentBranch,
  gitSource,
  layered,
  resolveRef,
  workingTree,
  type Source,
} from "./source";

interface VersionConfig {
  id: string;
  ref: string;
}

const force = process.argv.includes("--force");
const configs: VersionConfig[] = JSON.parse(
  fs.readFileSync(path.join(websiteDir, "versions.json"), "utf8"),
);

function sourcesFor(
  ref: string,
): { recipes: Source; resources: Source } | undefined {
  // 当前分支直接读取工作区, 便于开发时实时预览未提交的改动
  if (ref === currentBranch()) {
    return { recipes: workingTree, resources: workingTree };
  }
  const resolved = resolveRef(ref);
  if (!resolved) return undefined;
  const git = gitSource(resolved);
  return { recipes: git, resources: layered(git, workingTree) };
}

fs.mkdirSync(generatedDir, { recursive: true });

const built: VersionData[] = [];
for (const { id, ref } of configs) {
  const sources = sourcesFor(ref);
  if (!sources) {
    console.warn(`[data] 跳过 ${id}: 找不到分支 ${ref}`);
    continue;
  }
  const data = buildVersionData(id, sources.recipes, sources.resources);
  const dir = path.join(generatedDir, "data", id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "recipes.json"), JSON.stringify(data));
  console.log(
    `[data] ${id}: ${data.recipes.length} 个配方, ${data.items.length} 个物品`,
  );
  built.push(data);
}

if (built.length === 0) {
  throw new Error("没有可用的版本数据");
}

const index: VersionIndex = {
  default: built[0].version,
  versions: built.map((v) => v.version),
};
fs.writeFileSync(
  path.join(generatedDir, "data", "versions.json"),
  JSON.stringify(index),
);

const guiDir = path.join(generatedDir, "gui");
fs.mkdirSync(guiDir, { recursive: true });
for (const name of ["crafting_table", "stonecutter"]) {
  fs.copyFileSync(
    path.join(assetsDir, "textures", "gui", "container", `${name}.png`),
    path.join(guiDir, `${name}.png`),
  );
}

const itemIds = [
  ...new Set(built.flatMap((v) => v.items.map((i) => i.id))),
].sort();
const missing = await generateIcons(itemIds, force);
if (missing.length > 0) {
  console.warn(
    `[icons] ${missing.length} 个物品缺少图标: ${missing.join(", ")}`,
  );
}
