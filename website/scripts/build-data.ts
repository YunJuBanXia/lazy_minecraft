import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
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
    `[data] ${id}: ${data.recipes.length} 个配方, ${data.features.length} 个特性, ${data.items.length} 个物品`,
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

// 容器贴图自带槽位等内容, 这里只取四角和四边, 拼成可九宫格拉伸的纯色背景
const container = PNG.sync.read(
  fs.readFileSync(
    path.join(assetsDir, "textures", "gui", "container", "crafting_table.png"),
  ),
);
const PANEL_SIZE = 12;
const PANEL_EDGE = 3;
const panel = new PNG({ width: PANEL_SIZE, height: PANEL_SIZE });
for (let i = 0; i < panel.data.length; i += 4) {
  panel.data.set([198, 198, 198, 255], i);
}
const far = PANEL_SIZE - PANEL_EDGE;
const srcFar = { x: 176 - PANEL_EDGE, y: 166 - PANEL_EDGE };
const inner = PANEL_SIZE - 2 * PANEL_EDGE;
const blit = (
  sx: number,
  sy: number,
  w: number,
  h: number,
  dx: number,
  dy: number,
) => PNG.bitblt(container, panel, sx, sy, w, h, dx, dy);
blit(0, 0, PANEL_EDGE, PANEL_EDGE, 0, 0);
blit(srcFar.x, 0, PANEL_EDGE, PANEL_EDGE, far, 0);
blit(0, srcFar.y, PANEL_EDGE, PANEL_EDGE, 0, far);
blit(srcFar.x, srcFar.y, PANEL_EDGE, PANEL_EDGE, far, far);
blit(16, 0, inner, PANEL_EDGE, PANEL_EDGE, 0);
blit(16, srcFar.y, inner, PANEL_EDGE, PANEL_EDGE, far);
blit(0, 16, PANEL_EDGE, inner, 0, PANEL_EDGE);
blit(srcFar.x, 16, PANEL_EDGE, inner, far, PANEL_EDGE);
fs.writeFileSync(path.join(guiDir, "panel.png"), PNG.sync.write(panel));

const itemIds = [
  ...new Set(built.flatMap((v) => v.items.map((i) => i.id))),
].sort();
const missing = await generateIcons(itemIds, force);
if (missing.length > 0) {
  console.warn(
    `[icons] ${missing.length} 个物品缺少图标: ${missing.join(", ")}`,
  );
}
