#!/usr/bin/env python3
"""coopgame の docs/examples.md から、早見図のカードに出すサンプルコードを www/examples.json に書き出す。

使い方:
  python3 scripts/sync_examples.py --release [--allow-missing] [--repo OWNER/NAME]
      Cargo.lock の coopgame の版を読み、本体リポジトリのタグ v<版> の docs/examples.md を取得する。
      --allow-missing: タグやファイルが取得できない (未公開のリポジトリ、examples.md のない版) とき、
      既存の www/examples.json を残して警告だけ出す。
  python3 scripts/sync_examples.py <coopgame のリポジトリ>/docs/examples.md
      手元のファイルから作る (公開前の版を試すとき)。

docs/examples.md は `<!-- example: KEY -->` で区切った節に、見出し・説明・rust と python のコードブロックを持つ。
KEY は www/scenes/guide.js の SOLUTIONS のキーと同じ。
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "www" / "examples.json"
DEFAULT_REPO = "matsu7874/coopgame"

MARKER = re.compile(r"<!-- example: (\w+) -->")
BLOCK = re.compile(r"```(rust|python)\n(.*?)```", re.S)


def parse(text: str) -> dict:
    parts = MARKER.split(text)
    examples = {}
    # parts = [前置き, key1, 本文1, key2, 本文2, ...]
    for key, body in zip(parts[1::2], parts[2::2]):
        # 次の ## 見出し以降は別の節なので切る。
        body = re.split(r"\n## ", body)[0]
        title = re.search(r"^### (.+)$", body, re.M)
        blocks = {lang: code.rstrip() for lang, code in BLOCK.findall(body)}
        prose = BLOCK.sub("", body)
        prose = re.sub(r"^### .+$", "", prose, flags=re.M)
        lead = " ".join(line.strip() for line in prose.strip().splitlines() if line.strip())
        if "rust" not in blocks or "python" not in blocks:
            sys.exit(f"{key}: rust と python のコードブロックが必要")
        examples[key] = {
            "title": title.group(1).strip() if title else key,
            "lead": lead,
            "rust": blocks["rust"],
            "python": blocks["python"],
        }
    if not examples:
        sys.exit("<!-- example: KEY --> の節が見つからない")
    return examples


def locked_version() -> str:
    lock = (ROOT / "Cargo.lock").read_text(encoding="utf-8")
    for block in lock.split("[[package]]"):
        if 'name = "coopgame"\n' in block:
            match = re.search(r'^version = "([^"]+)"$', block, re.M)
            if match:
                return match.group(1)
    sys.exit("Cargo.lock に coopgame がない")


def fetch(repo: str, tag: str) -> str:
    url = f"https://raw.githubusercontent.com/{repo}/{tag}/docs/examples.md"
    request = urllib.request.Request(url, headers={"User-Agent": "coopgame-demo-sync"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def warn(message: str) -> None:
    # GitHub Actions では注釈として表示される。
    prefix = "::warning::" if os.environ.get("GITHUB_ACTIONS") else "警告: "
    print(prefix + message)


def write(examples: dict, source: str) -> None:
    payload = {"source": source, "examples": examples}
    TARGET.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(examples)} 個のサンプルを {TARGET.relative_to(ROOT)} に書き出した ({source})")


def main() -> None:
    parser = argparse.ArgumentParser(description="docs/examples.md から www/examples.json を作る")
    parser.add_argument("path", nargs="?", help="手元の docs/examples.md")
    parser.add_argument("--release", action="store_true", help="Cargo.lock の版のタグから取得する")
    parser.add_argument("--allow-missing", action="store_true", help="取得できなければ既存のファイルを残す")
    parser.add_argument("--repo", default=DEFAULT_REPO, help=f"本体リポジトリ (既定 {DEFAULT_REPO})")
    args = parser.parse_args()

    if args.release == bool(args.path):
        parser.error("--release か、手元のファイルのどちらか一方を指定する")

    if args.path:
        write(parse(Path(args.path).read_text(encoding="utf-8")), "手元の docs/examples.md (公開前の版)")
        return

    version = locked_version()
    tag = f"v{version}"
    try:
        text = fetch(args.repo, tag)
    except (urllib.error.URLError, TimeoutError) as error:
        message = f"{args.repo} のタグ {tag} の docs/examples.md を取得できない ({error})"
        if args.allow_missing and TARGET.exists():
            warn(message + "。既存の www/examples.json を使う")
            return
        sys.exit(message)
    write(parse(text), f"coopgame {tag} の docs/examples.md")


if __name__ == "__main__":
    main()
