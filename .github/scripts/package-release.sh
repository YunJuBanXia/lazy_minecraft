#!/usr/bin/env bash
# 用法: package-release.sh <tag> <输出目录>
# 将 main 与所有 Minecraft 版本分支下的 src/ 分别打包为 zip
set -euo pipefail

tag=$1
out=$2

# 旧版本号 1.xx 或 1.xx.xx, 新版本号 xx.xx 或 xx.xx.xx
# 仅匹配正式版本分支
branch_pattern='^(1\.[0-9]+(\.[0-9]+)?|[0-9]{2,}\.[0-9]+(\.[0-9]+)?)$'

commit=$(git rev-parse "${tag}^{commit}")
if ! git merge-base --is-ancestor "$commit" origin/main; then
  echo "tag ${tag} 不在 main 分支上" >&2
  exit 1
fi

# main 始终对应最新支持的版本, 版本号取自网页生成器的版本配置
main_version=$(git show "${commit}:website/versions.json" | jq -r '.[] | select(.ref == "main") | .id')
if [[ -z $main_version ]]; then
  echo "website/versions.json 中没有 main 对应的版本" >&2
  exit 1
fi

declare -A refs=([$main_version]=$commit)
while read -r branch; do
  if [[ $branch =~ $branch_pattern ]]; then
    if [[ -n ${refs[$branch]:-} ]]; then
      echo "版本 ${branch} 同时对应 main 与同名分支" >&2
      exit 1
    fi
    refs[$branch]="origin/${branch}"
  fi
done < <(git for-each-ref --format='%(refname:strip=3)' refs/remotes/origin)

mkdir -p "$out"
for version in "${!refs[@]}"; do
  ref=${refs[$version]}
  if ! git cat-file -e "${ref}:src/pack.mcmeta" 2>/dev/null; then
    echo "${ref} 中缺少 src/pack.mcmeta" >&2
    exit 1
  fi
  file="${out}/lazy_minecraft-${tag}-mc${version}.zip"
  git archive --format=zip -o "$file" "${ref}:src"
  echo "已打包 ${file} (来自 ${ref})"
done
