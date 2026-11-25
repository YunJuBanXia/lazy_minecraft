import fs from "node:fs";
import path from "node:path";
import type { ElementSpec, GuiTransform, IconSpec, Vec3 } from "../shared/icon";
import { resolveAlias } from "./aliases";
import { assetsDir } from "./paths";

const strip = (id: string) => id.replace(/^minecraft:/, "");

const DEFAULT_GUI: GuiTransform = {
  rotation: [0, 0, 0],
  translation: [0, 0, 0],
  scale: [1, 1, 1],
};

const TINT_COLORS: Record<string, number> = {
  "minecraft:grass": 0x7cbd6b,
  "minecraft:foliage": 0x59ae30,
  "minecraft:dry_foliage": 0x8a7a47,
  "minecraft:water": 0x3f76e4,
};

const readJson = (file: string): any | undefined =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : undefined;

export const textureFile = (texture: string) =>
  path.join(assetsDir, "textures", `${strip(texture)}.png`);

interface ItemModelRef {
  model: string;
  tints: number[];
}

function parseTints(raw: any[] | undefined): number[] {
  return (raw ?? []).map((tint) => {
    if (tint.type === "minecraft:constant") return tint.value & 0xffffff;
    if (TINT_COLORS[tint.type] !== undefined) return TINT_COLORS[tint.type];
    if (typeof tint.default === "number") return tint.default & 0xffffff;
    return 0xffffff;
  });
}

/** 从 items/*.json 的模型树中取出具有代表性的静态模型 */
function pickModel(node: any): ItemModelRef | undefined {
  if (!node) return undefined;
  switch (node.type) {
    case "minecraft:model":
      return { model: node.model, tints: parseTints(node.tints) };
    case "minecraft:special":
      return { model: node.base, tints: [] };
    case "minecraft:condition":
      return pickModel(node.on_false ?? node.on_true);
    case "minecraft:select":
      return pickModel(node.fallback ?? node.cases?.[0]?.model);
    case "minecraft:range_dispatch":
      return pickModel(node.fallback ?? node.entries?.[0]?.model);
    case "minecraft:composite":
      return pickModel(node.models?.[0]);
    default:
      return undefined;
  }
}

interface FlatModel {
  root?: string;
  elements?: any[];
  textures: Record<string, string>;
  gui?: any;
  guiLight?: string;
}

function flattenModel(modelId: string): FlatModel | undefined {
  const chain: any[] = [];
  let root: string | undefined;
  let current: string | undefined = strip(modelId);
  while (current) {
    if (current.startsWith("builtin/")) {
      root = current.slice("builtin/".length);
      break;
    }
    const json = readJson(path.join(assetsDir, "models", `${current}.json`));
    if (!json) return undefined;
    chain.push(json);
    current = json.parent ? strip(json.parent) : undefined;
  }

  const textures: Record<string, string> = {};
  for (const json of [...chain].reverse()) {
    Object.assign(textures, json.textures);
  }
  const firstDefined = <T>(pick: (json: any) => T | undefined) => {
    for (const json of chain) {
      const value = pick(json);
      if (value !== undefined) return value;
    }
    return undefined;
  };

  return {
    root,
    textures,
    elements: firstDefined((j) => j.elements),
    gui: firstDefined((j) => j.display?.gui),
    guiLight: firstDefined((j) => j.gui_light),
  };
}

function resolveTexture(
  ref: string | undefined,
  textures: Record<string, string>,
): string | undefined {
  let value = ref;
  for (let i = 0; i < 16 && value?.startsWith("#"); i++) {
    value = textures[value.slice(1)];
  }
  return value && !value.startsWith("#") ? strip(value) : undefined;
}

function bakeElements(
  elements: any[],
  textures: Record<string, string>,
): ElementSpec[] {
  const result: ElementSpec[] = [];
  for (const element of elements) {
    const faces: ElementSpec["faces"] = {};
    for (const [dir, face] of Object.entries<any>(element.faces ?? {})) {
      const texture = resolveTexture(face.texture, textures);
      if (!texture || !fs.existsSync(textureFile(texture))) continue;
      faces[dir as keyof ElementSpec["faces"]] = {
        texture,
        uv: face.uv,
        rotation: face.rotation,
        tintindex: face.tintindex,
      };
    }
    if (Object.keys(faces).length === 0) continue;
    result.push({
      from: element.from,
      to: element.to,
      rotation: element.rotation,
      faces,
    });
  }
  return result;
}

const cubeOf = (texture: string): ElementSpec => {
  const face = { texture };
  return {
    from: [0, 0, 0],
    to: [16, 16, 16],
    faces: {
      down: face,
      up: face,
      north: face,
      south: face,
      west: face,
      east: face,
    },
  };
};

const BLOCK_GUI: GuiTransform = {
  rotation: [30, 225, 0],
  translation: [0, 0, 0],
  scale: [0.625, 0.625, 0.625],
};

function planFromModel(modelId: string, tints: number[]): IconSpec | undefined {
  const model = flattenModel(modelId);
  if (!model) return undefined;
  const gui: GuiTransform = model.gui
    ? {
        rotation: model.gui.rotation ?? DEFAULT_GUI.rotation,
        translation: model.gui.translation ?? DEFAULT_GUI.translation,
        scale: model.gui.scale ?? DEFAULT_GUI.scale,
      }
    : DEFAULT_GUI;

  if (model.elements) {
    const elements = bakeElements(model.elements, model.textures);
    if (elements.length === 0) return undefined;
    return {
      kind: "model",
      elements,
      gui,
      flatLight: model.guiLight === "front",
      tints,
    };
  }

  if (model.root === "generated") {
    const layers: { texture: string; tint?: number }[] = [];
    for (let i = 0; model.textures[`layer${i}`]; i++) {
      const texture = resolveTexture(
        model.textures[`layer${i}`],
        model.textures,
      );
      if (texture && fs.existsSync(textureFile(texture))) {
        layers.push({ texture, tint: tints[i] });
      }
    }
    return layers.length > 0 ? { kind: "flat", layers } : undefined;
  }

  // 箱子, 床等依赖实体渲染器的物品, 以粒子贴图渲染的方块代替
  const particle = resolveTexture("#particle", model.textures);
  if (particle && fs.existsSync(textureFile(particle))) {
    return {
      kind: "model",
      elements: [cubeOf(particle)],
      gui: BLOCK_GUI,
      flatLight: false,
      tints: [],
    };
  }
  return undefined;
}

/** 找到物品定义中箱子专用模型使用的实体贴图名 */
function findChestTexture(node: any): string | undefined {
  if (!node) return undefined;
  if (
    node.type === "minecraft:special" &&
    node.model?.type === "minecraft:chest"
  ) {
    return strip(node.model.texture);
  }
  return findChestTexture(
    node.model ?? node.fallback ?? node.on_false ?? node.cases?.[0]?.model,
  );
}

// 实体贴图为 64x64, 面的 UV 以 16 为基准缩放
const CHEST_UV_SCALE = 16 / 64;
const CHEST_TOP_ROTATION = 90;

/** 箱子在原版由实体渲染器绘制, 这里按其模型结构还原为带 UV 的立方体 */
function chestBox(
  from: Vec3,
  to: Vec3,
  [u, v]: [number, number],
  [w, h, d]: Vec3,
  texture: string,
): ElementSpec {
  const region = (x1: number, y1: number, x2: number, y2: number) =>
    [x1, y1, x2, y2].map((n) => n * CHEST_UV_SCALE) as [
      number,
      number,
      number,
      number,
    ];
  const face = (uv: [number, number, number, number], rotation?: number) => ({
    texture,
    uv,
    rotation,
  });
  // 实体模型的 y 轴向下, 因此贴图中的 down 区域对应世界中的顶面
  // 锁扣面朝东, 相当于将所有面绕 y 轴转 90 度
  return {
    from,
    to,
    faces: {
      up: face(region(u + d + w, v, u + d + 2 * w, v + d), CHEST_TOP_ROTATION),
      down: face(region(u + d, v, u + d + w, v + d)),
      east: face(region(u + d, v + d, u + d + w, v + d + h)),
      south: face(region(u + d + w, v + d, u + 2 * d + w, v + d + h)),
      west: face(region(u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h)),
      north: face(region(u, v + d, u + d, v + d + h)),
    },
  };
}

function planChest(name: string): IconSpec | undefined {
  const definition = readJson(path.join(assetsDir, "items", `${name}.json`));
  const texture = findChestTexture(definition?.model);
  if (!texture || !fs.existsSync(textureFile(`entity/chest/${texture}`))) {
    return undefined;
  }
  const entity = `entity/chest/${texture}`;
  const template = flattenModel("item/template_chest");
  return {
    kind: "model",
    elements: [
      chestBox([1, 0, 1], [15, 10, 15], [0, 19], [14, 10, 14], entity),
      chestBox([1, 9, 1], [15, 14, 15], [0, 0], [14, 5, 14], entity),
      chestBox([15, 7, 7], [16, 11, 9], [0, 0], [2, 4, 1], entity),
    ],
    gui: template?.gui
      ? {
          rotation: template.gui.rotation,
          translation: template.gui.translation,
          scale: template.gui.scale,
        }
      : DEFAULT_GUI,
    flatLight: false,
    tints: [],
  };
}

export function planIcon(itemId: string): IconSpec | undefined {
  const name = strip(resolveAlias(itemId));
  const chest = planChest(name);
  if (chest) return chest;
  const definition = readJson(path.join(assetsDir, "items", `${name}.json`));
  const ref = pickModel(definition?.model);
  const candidates: ItemModelRef[] = [
    ...(ref ? [ref] : []),
    { model: `item/${name}`, tints: [] },
    { model: `block/${name}`, tints: [] },
  ];
  for (const candidate of candidates) {
    const plan = planFromModel(candidate.model, candidate.tints);
    if (plan) return plan;
  }
  if (fs.existsSync(textureFile(`item/${name}`))) {
    return { kind: "flat", layers: [{ texture: `item/${name}` }] };
  }
  return undefined;
}
