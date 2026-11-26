import type { RecipeType } from "../shared/types";

// 坐标单位为原版 GUI 贴图像素, 取自 256x256 的容器贴图
interface Sprite {
  /** `generated/gui` 目录下的贴图名 */
  texture: "crafting_table" | "stonecutter";
  sx: number;
  sy: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
}

export interface GuiLayout {
  width: number;
  height: number;
  sprites: Sprite[];
  /** 输入槽位的物品左上角坐标, 按行优先排列 */
  inputs: { x: number; y: number }[];
  output: { x: number; y: number };
  gridWidth: number;
}

const CRAFTING_GRID = Array.from({ length: 9 }, (_, i) => ({
  x: 1 + (i % 3) * 18,
  y: 1 + Math.floor(i / 3) * 18,
}));

// 容器背景九宫格的边框宽度, 单位为原版 GUI 贴图像素
export const PANEL_BORDER = 3;

const crafting: GuiLayout = {
  width: 116,
  height: 54,
  sprites: [
    {
      texture: "crafting_table",
      sx: 29,
      sy: 16,
      w: 116,
      h: 54,
      dx: 0,
      dy: 0,
    },
  ],
  inputs: CRAFTING_GRID,
  output: { x: 95, y: 19 },
  gridWidth: 3,
};

// 切石机的输出位于配方列表面板内, 这里只截取输入槽与输出槽, 箭头借用工作台贴图
const stonecutter: GuiLayout = {
  width: 78,
  height: 26,
  sprites: [
    {
      texture: "stonecutter",
      sx: 19,
      sy: 32,
      w: 18,
      h: 18,
      dx: 0,
      dy: 4,
    },
    {
      texture: "crafting_table",
      sx: 90,
      sy: 35,
      w: 22,
      h: 15,
      dx: 28,
      dy: 5,
    },
    {
      texture: "stonecutter",
      sx: 138,
      sy: 28,
      w: 26,
      h: 26,
      dx: 52,
      dy: 0,
    },
  ],
  inputs: [{ x: 1, y: 5 }],
  output: { x: 57, y: 5 },
  gridWidth: 1,
};

export const GUI_LAYOUTS: Record<RecipeType, GuiLayout> = {
  crafting_shaped: crafting,
  crafting_shapeless: crafting,
  stonecutting: stonecutter,
};

export const GUI_TEXTURE_SIZE = 256;

export const MAX_GUI_SCALE = 3;

// 配方卡片内边距, 单位为原版 GUI 贴图像素
export const PANEL_PADDING = 3;

const CARD_MIN_GUI_WIDTH =
  Math.max(...Object.values(GUI_LAYOUTS).map((layout) => layout.width)) +
  2 * (PANEL_BORDER + PANEL_PADDING);

// 卡片内的 GUI 为固定宽度, 网格列宽低于该值时 GUI 会溢出卡片
export function cardMinWidth(scale: number) {
  return CARD_MIN_GUI_WIDTH * scale;
}

// 仅使用整数倍缩放以保持像素清晰, 容器放不下最大缩放的卡片时逐级缩小
export function fitGuiScale(containerWidth: number) {
  for (let scale = MAX_GUI_SCALE; scale > 1; scale--) {
    if (cardMinWidth(scale) <= containerWidth) return scale;
  }
  return 1;
}
