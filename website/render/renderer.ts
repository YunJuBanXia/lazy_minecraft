import * as THREE from "three";
import type {
  ElementSpec,
  FlatIconSpec,
  ModelIconSpec,
  Vec3,
} from "../shared/icon";

THREE.ColorManagement.enabled = false;

type Dir = keyof ElementSpec["faces"];

// 顶点顺序与 Minecraft 的 FaceInfo 一致, 依次对应 uv 的 (u1,v1) (u1,v2) (u2,v2) (u2,v1)
const FACE_VERTICES: Record<
  Dir,
  ["from" | "to", "from" | "to", "from" | "to"][]
> = {
  down: [
    ["from", "from", "to"],
    ["from", "from", "from"],
    ["to", "from", "from"],
    ["to", "from", "to"],
  ],
  up: [
    ["from", "to", "from"],
    ["from", "to", "to"],
    ["to", "to", "to"],
    ["to", "to", "from"],
  ],
  north: [
    ["to", "to", "from"],
    ["to", "from", "from"],
    ["from", "from", "from"],
    ["from", "to", "from"],
  ],
  south: [
    ["from", "to", "to"],
    ["from", "from", "to"],
    ["to", "from", "to"],
    ["to", "to", "to"],
  ],
  west: [
    ["from", "to", "from"],
    ["from", "from", "from"],
    ["from", "from", "to"],
    ["from", "to", "to"],
  ],
  east: [
    ["to", "to", "to"],
    ["to", "from", "to"],
    ["to", "from", "from"],
    ["to", "to", "from"],
  ],
};

function defaultUv(dir: Dir, f: Vec3, t: Vec3): number[] {
  switch (dir) {
    case "down":
      return [f[0], 16 - t[2], t[0], 16 - f[2]];
    case "up":
      return [f[0], f[2], t[0], t[2]];
    case "north":
      return [16 - t[0], 16 - t[1], 16 - f[0], 16 - f[1]];
    case "south":
      return [f[0], 16 - t[1], t[0], 16 - f[1]];
    case "west":
      return [f[2], 16 - t[1], t[2], 16 - f[1]];
    case "east":
      return [16 - t[2], 16 - t[1], 16 - f[2], 16 - f[1]];
  }
}

// 观察空间中的主光源方向, 由原版 GUI 方块图标的三个可见面亮度拟合得到
const GUI_LIGHT = new THREE.Vector3(-0.25, 0.72, 0.75);
const AMBIENT = 0.4;

/** normal 须已变换到观察空间 */
function shadeOf(normal: THREE.Vector3): number {
  return (
    AMBIENT + (1 - AMBIENT) * Math.min(1, Math.max(0, normal.dot(GUI_LIGHT)))
  );
}

const textureCache = new Map<string, Promise<HTMLCanvasElement>>();

/** 动画贴图为纵向帧序列, 只取第一帧 */
function loadTexture(texture: string): Promise<HTMLCanvasElement> {
  let cached = textureCache.get(texture);
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const size = img.width;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = Math.min(img.height, size);
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error(`无法加载贴图 ${texture}`));
      img.src = `/textures/${texture}.png`;
    });
    textureCache.set(texture, cached);
  }
  return cached;
}

function tintColor(tint: number | undefined): [number, number, number] {
  if (tint === undefined) return [1, 1, 1];
  return [
    ((tint >> 16) & 255) / 255,
    ((tint >> 8) & 255) / 255,
    (tint & 255) / 255,
  ];
}

function applyTint(
  canvas: HTMLCanvasElement,
  tint: number | undefined,
): HTMLCanvasElement {
  if (tint === undefined) return canvas;
  const [r, g, b] = tintColor(tint);
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0);
  const data = ctx.getImageData(0, 0, out.width, out.height);
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i] *= r;
    data.data[i + 1] *= g;
    data.data[i + 2] *= b;
  }
  ctx.putImageData(data, 0, 0);
  return out;
}

export async function renderFlat(spec: FlatIconSpec): Promise<string> {
  const layers = await Promise.all(
    spec.layers.map(async (l) =>
      applyTint(await loadTexture(l.texture), l.tint),
    ),
  );
  const size = Math.max(...layers.map((l) => l.width));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  for (const layer of layers) ctx.drawImage(layer, 0, 0, size, size);
  return canvas.toDataURL("image/png");
}

let renderer: THREE.WebGLRenderer | undefined;

export async function renderModel(
  spec: ModelIconSpec,
  size: number,
): Promise<string> {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
  }
  renderer.setSize(size, size, false);

  const rad = THREE.MathUtils.degToRad;
  const guiRotation = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(
      rad(spec.gui.rotation[0]),
      rad(spec.gui.rotation[1]),
      rad(spec.gui.rotation[2]),
      "XYZ",
    ),
  );

  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);

  const materials = new Map<string, THREE.MeshBasicMaterial>();
  const materialOf = async (texture: string) => {
    let material = materials.get(texture);
    if (!material) {
      const map = new THREE.CanvasTexture(await loadTexture(texture));
      map.magFilter = map.minFilter = THREE.NearestFilter;
      map.generateMipmaps = false;
      material = new THREE.MeshBasicMaterial({
        map,
        vertexColors: true,
        transparent: true,
        alphaTest: 0.01,
        side: THREE.DoubleSide,
      });
      materials.set(texture, material);
    }
    return material;
  };

  for (const element of spec.elements) {
    const bounds = { from: element.from, to: element.to };
    for (const [dir, face] of Object.entries(element.faces) as [
      Dir,
      NonNullable<ElementSpec["faces"][Dir]>,
    ][]) {
      const positions: THREE.Vector3[] = FACE_VERTICES[dir].map(
        ([x, y, z]) =>
          new THREE.Vector3(bounds[x][0], bounds[y][1], bounds[z][2]),
      );

      const rotation = element.rotation;
      if (rotation) {
        const axis = new THREE.Vector3(
          +(rotation.axis === "x"),
          +(rotation.axis === "y"),
          +(rotation.axis === "z"),
        );
        const origin = new THREE.Vector3(...rotation.origin);
        const angle = THREE.MathUtils.degToRad(rotation.angle);
        const scale = rotation.rescale ? 1 / Math.cos(angle) : 1;
        for (const p of positions) {
          p.sub(origin).applyAxisAngle(axis, angle);
          if (rotation.axis !== "x") p.x *= scale;
          if (rotation.axis !== "y") p.y *= scale;
          if (rotation.axis !== "z") p.z *= scale;
          p.add(origin);
        }
      }

      const normal = new THREE.Vector3()
        .subVectors(positions[1], positions[0])
        .cross(new THREE.Vector3().subVectors(positions[2], positions[1]))
        .normalize();
      const shade = spec.flatLight
        ? 1
        : shadeOf(normal.applyMatrix4(guiRotation));
      const tint =
        face.tintindex !== undefined && face.tintindex >= 0
          ? spec.tints[face.tintindex]
          : undefined;
      const [r, g, b] = tintColor(tint);

      const [u1, v1, u2, v2] = (face.uv ??
        defaultUv(dir, element.from, element.to)) as number[];
      const corners = [
        [u1, v1],
        [u1, v2],
        [u2, v2],
        [u2, v1],
      ];
      const shift = (face.rotation ?? 0) / 90;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          positions.flatMap((p) => [
            p.x / 16 - 0.5,
            p.y / 16 - 0.5,
            p.z / 16 - 0.5,
          ]),
          3,
        ),
      );
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(
          positions.flatMap((_, i) => {
            const [u, v] = corners[(i + 4 - shift) % 4];
            return [u / 16, 1 - v / 16];
          }),
          2,
        ),
      );
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(
          positions.flatMap(() => [shade * r, shade * g, shade * b]),
          3,
        ),
      );
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      group.add(new THREE.Mesh(geometry, await materialOf(face.texture)));
    }
  }

  const { translation, scale } = spec.gui;
  group.matrixAutoUpdate = false;
  group.matrix
    .makeTranslation(
      translation[0] / 16,
      translation[1] / 16,
      translation[2] / 16,
    )
    .multiply(guiRotation)
    .multiply(new THREE.Matrix4().makeScale(...scale));

  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -10, 10);
  camera.position.z = 5;
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");

  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
  materials.forEach((m) => {
    m.map?.dispose();
    m.dispose();
  });
  return url;
}

Object.assign(window, { renderFlat, renderModel });
