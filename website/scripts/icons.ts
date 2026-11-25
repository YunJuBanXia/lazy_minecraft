import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import type { IconSpec } from "../shared/icon";
import { planIcon, textureFile } from "./models";
import { assetsDir, generatedDir, websiteDir } from "./paths";

const ICON_SIZE = 128;
const iconDir = path.join(generatedDir, "icons");
const manifestFile = path.join(iconDir, "manifest.json");

const idToName = (id: string) => id.replace(/^minecraft:/, "");

function pngSize(file: string): [number, number] {
  const buf = fs.readFileSync(file);
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

/** 单层, 无着色且为正方形的贴图可直接复制 */
function canCopy(spec: IconSpec): string | undefined {
  if (spec.kind !== "flat" || spec.layers.length !== 1) return undefined;
  const [layer] = spec.layers;
  if (layer.tint !== undefined) return undefined;
  const file = textureFile(layer.texture);
  const [w, h] = pngSize(file);
  return w === h ? file : undefined;
}

async function startServer(rendererJs: string) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url ?? "/");
    if (url === "/") {
      res.setHeader("content-type", "text/html");
      res.end('<!doctype html><script src="/renderer.js"></script>');
    } else if (url === "/renderer.js") {
      res.setHeader("content-type", "text/javascript");
      res.end(rendererJs);
    } else if (url.startsWith("/textures/")) {
      const file = path.join(assetsDir, url.slice(1));
      if (file.startsWith(assetsDir) && fs.existsSync(file)) {
        res.setHeader("content-type", "image/png");
        fs.createReadStream(file).pipe(res);
      } else {
        res.statusCode = 404;
        res.end();
      }
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  return { server, origin: `http://127.0.0.1:${port}` };
}

export async function generateIcons(
  itemIds: string[],
  force: boolean,
): Promise<string[]> {
  fs.mkdirSync(iconDir, { recursive: true });
  const manifest: Record<string, string> = fs.existsSync(manifestFile)
    ? JSON.parse(fs.readFileSync(manifestFile, "utf8"))
    : {};

  const missing: string[] = [];
  const pending: { name: string; spec: IconSpec; hash: string }[] = [];
  for (const id of itemIds) {
    const name = idToName(id);
    const spec = planIcon(id);
    if (!spec) {
      missing.push(id);
      continue;
    }
    const hash = createHash("sha1")
      .update(JSON.stringify([ICON_SIZE, spec]))
      .digest("hex");
    const output = path.join(iconDir, `${name}.png`);
    if (!force && manifest[name] === hash && fs.existsSync(output)) continue;

    const source = canCopy(spec);
    if (source) {
      fs.copyFileSync(source, output);
      manifest[name] = hash;
    } else {
      pending.push({ name, spec, hash });
    }
  }

  if (pending.length > 0) {
    console.log(`[icons] 渲染 ${pending.length} 个图标`);
    const bundle = await build({
      entryPoints: [path.join(websiteDir, "render", "renderer.ts")],
      bundle: true,
      write: false,
      format: "iife",
      target: "es2022",
    });
    const { server, origin } = await startServer(bundle.outputFiles[0].text);
    const browser = await chromium.launch({
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
      ],
    });
    try {
      const page = await browser.newPage();
      page.on("pageerror", (e) => console.warn("[icons] 页面错误:", e.message));
      await page.goto(origin);
      for (const { name, spec, hash } of pending) {
        try {
          const dataUrl: string = await page.evaluate(
            ([s, size]) =>
              s.kind === "flat"
                ? (window as any).renderFlat(s)
                : (window as any).renderModel(s, size),
            [spec, ICON_SIZE] as const,
          );
          fs.writeFileSync(
            path.join(iconDir, `${name}.png`),
            Buffer.from(dataUrl.split(",")[1], "base64"),
          );
          manifest[name] = hash;
        } catch (e) {
          console.warn(`[icons] 渲染失败 ${name}:`, (e as Error).message);
          missing.push(name);
        }
      }
    } finally {
      await browser.close();
      server.close();
    }
  }

  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  return missing;
}
