import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { repoRoot, websiteDir } from "./paths";

const MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const RESOURCES_URL = "https://resources.download.minecraft.net";

/** 构建所需的原版文件, 其余内容不会被写入磁盘 */
const JAR_PREFIXES = [
  "assets/minecraft/items/",
  "assets/minecraft/lang/",
  "assets/minecraft/models/",
  "assets/minecraft/textures/block/",
  "assets/minecraft/textures/item/",
  "assets/minecraft/textures/gui/container/",
  "assets/minecraft/textures/entity/chest/",
  "data/minecraft/tags/item/",
];
const LANGUAGES = ["en_us", "zh_cn"];

const force = process.argv.includes("--force");
const versions: { id: string }[] = JSON.parse(
  fs.readFileSync(path.join(websiteDir, "versions.json"), "utf8"),
);
// 第一项为最新版本, 资源取自该版本的客户端
const version = versions[0].id;

const complete = () =>
  LANGUAGES.every((l) =>
    fs.existsSync(path.join(repoRoot, `assets/minecraft/lang/${l}.json`)),
  ) && fs.existsSync(path.join(repoRoot, "data/minecraft/tags/item"));

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`请求失败 ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

async function getBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`请求失败 ${res.status}: ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

function write(file: string, data: Uint8Array) {
  const target = path.join(repoRoot, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
}

async function main() {
  if (!force && complete()) {
    console.log("[assets] 已存在原版资源, 跳过下载 (--force 可强制重新下载)");
    return;
  }

  const manifest = await getJson<{
    versions: { id: string; url: string }[];
  }>(MANIFEST_URL);
  const entry = manifest.versions.find((v) => v.id === version);
  if (!entry) throw new Error(`官方清单中没有版本 ${version}`);
  const meta = await getJson<{
    downloads: { client: { url: string; sha1: string } };
    assetIndex: { url: string };
  }>(entry.url);

  console.log(`[assets] 下载 ${version} 客户端`);
  const jar = await getBytes(meta.downloads.client.url);
  const sha1 = createHash("sha1").update(jar).digest("hex");
  if (sha1 !== meta.downloads.client.sha1) {
    throw new Error("客户端 jar 校验失败");
  }

  fs.rmSync(path.join(repoRoot, "assets"), { recursive: true, force: true });
  fs.rmSync(path.join(repoRoot, "data"), { recursive: true, force: true });

  const files = unzipSync(jar, {
    filter: (f) => JAR_PREFIXES.some((p) => f.name.startsWith(p)),
  });
  for (const [name, data] of Object.entries(files)) {
    if (data.length > 0) write(name, data);
  }

  // 语言文件不一定在 jar 内, 缺失的从资源索引下载
  const index = await getJson<{
    objects: Record<string, { hash: string }>;
  }>(meta.assetIndex.url);
  for (const lang of LANGUAGES) {
    const file = `assets/minecraft/lang/${lang}.json`;
    if (fs.existsSync(path.join(repoRoot, file))) continue;
    const object = index.objects[`minecraft/lang/${lang}.json`];
    if (!object) throw new Error(`资源索引中没有 ${lang}`);
    const { hash } = object;
    write(file, await getBytes(`${RESOURCES_URL}/${hash.slice(0, 2)}/${hash}`));
  }

  console.log(`[assets] 已写入 ${Object.keys(files).length} 个文件`);
}

await main();
