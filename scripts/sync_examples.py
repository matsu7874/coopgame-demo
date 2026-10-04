#!/usr/bin/env python3
"""coopgame の docs/examples.md から、早見図のカードに出すサンプルコードを www/examples.json に書き出す。

使い方: python3 scripts/sync_examples.py <coopgame のリポジトリ>/docs/examples.md

docs/examples.md は `<!-- example: KEY -->` で区切った節に、見出し・説明・rust と python のコードブロックを持つ。
KEY は www/scenes/guide.js の SOLUTIONS のキーと同じ。
"""
import json
import re
import sys
from pathlib import Path

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
    return examples


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source = Path(sys.argv[1])
    examples = parse(source.read_text(encoding="utf-8"))
    target = Path(__file__).resolve().parent.parent / "www" / "examples.json"
    target.write_text(json.dumps(examples, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(examples)} 個のサンプルを {target} に書き出した")


if __name__ == "__main__":
    main()
