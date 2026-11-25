export type Vec3 = [number, number, number];

export interface FaceSpec {
  /** 已解析引用后的贴图路径, 如 `block/stone` */
  texture: string;
  uv?: [number, number, number, number];
  rotation?: number;
  tintindex?: number;
}

export interface ElementSpec {
  from: Vec3;
  to: Vec3;
  rotation?: {
    origin: Vec3;
    axis: "x" | "y" | "z";
    angle: number;
    rescale?: boolean;
  };
  faces: Partial<
    Record<"down" | "up" | "north" | "south" | "west" | "east", FaceSpec>
  >;
}

export interface GuiTransform {
  rotation: Vec3;
  translation: Vec3;
  scale: Vec3;
}

export interface FlatIconSpec {
  kind: "flat";
  layers: { texture: string; tint?: number }[];
}

export interface ModelIconSpec {
  kind: "model";
  elements: ElementSpec[];
  gui: GuiTransform;
  /** `front` 表示 GUI 中使用平面光照 */
  flatLight: boolean;
  tints: number[];
}

export type IconSpec = FlatIconSpec | ModelIconSpec;
