import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths";

export interface Source {
  list(dir: string): string[];
  read(file: string): string | undefined;
}

function git(args: string[]): string | undefined {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
}

export function currentBranch(): string | undefined {
  return git(["rev-parse", "--abbrev-ref", "HEAD"])?.trim();
}

/** 返回可解析的 git 引用, 优先本地分支, 其次 origin 远程分支 */
export function resolveRef(ref: string): string | undefined {
  for (const candidate of [ref, `origin/${ref}`]) {
    if (git(["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`])) {
      return candidate;
    }
  }
  return undefined;
}

export const workingTree: Source = {
  list(dir) {
    const abs = path.join(repoRoot, dir);
    return fs.existsSync(abs) ? fs.readdirSync(abs).sort() : [];
  },
  read(file) {
    const abs = path.join(repoRoot, file);
    return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : undefined;
  },
};

export function gitSource(ref: string): Source {
  return {
    list(dir) {
      const out = git(["ls-tree", "--name-only", ref, `${dir}/`]);
      return (out ?? "")
        .split("\n")
        .filter(Boolean)
        .map((p) => path.posix.basename(p))
        .sort();
    },
    read(file) {
      return git(["show", `${ref}:${file}`]);
    },
  };
}

/** 依次尝试多个来源, 用于旧分支缺少资源文件时回退到工作区 */
export function layered(...sources: Source[]): Source {
  return {
    list(dir) {
      for (const s of sources) {
        const r = s.list(dir);
        if (r.length > 0) return r;
      }
      return [];
    },
    read(file) {
      for (const s of sources) {
        const r = s.read(file);
        if (r !== undefined) return r;
      }
      return undefined;
    },
  };
}
