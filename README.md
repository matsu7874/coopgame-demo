# coopgame-demo

協力ゲームの解 (仁・Shapley 値・コア・カーネル) をブラウザで動かして見るデモ。
計算は crates.io で公開している [coopgame](https://crates.io/crates/coopgame) を WASM にビルドして、ブラウザの中で行う。

| シーン | 内容 | 使う coopgame の機能 |
|---|---|---|
| 3 人の分け前 | 特性関数を動かし、配分三角形のコア・カーネル・仁・Shapley 値を見る。自分の提案をドラッグすると、不満を持つ提携が分かる | `nucleolus`, `kernel_set`, `plot::core_vertices`, `values::shapley` |
| タルムードの遺産 | 遺産額に対する各規則の配分の推移。タルムード則と LP で求めた仁の一致を確かめる | `bankruptcy::{talmud_rule, constrained_equal_awards, constrained_equal_losses}`, `oracle::bankruptcy`, `nucleolus` |
| 議会の投票力 | 議席の割合と投票力 (Shapley–Shubik 指数・Banzhaf 指数・仁) の違い | `oracle::voting`, `oracle::nucleolus`, `values` |
| 水道管の費用 | 最小全域木ゲームの費用分担。Bird 規則・Shapley 値・仁がコアに入るか | `oracle::spanning_tree`, `properties::is_in_core` |
| どの解を使う? | 知りたいことに答えて、使う解 (指標) と関数・CLI・Python の呼び方を選ぶ早見図 | (計算なし) |

## 動かし方

[wasm-pack](https://rustwasm.github.io/wasm-pack/) が必要。

```bash
wasm-pack build --release --target web --out-dir www/pkg --no-typescript
python3 -m http.server 8000 --directory www
```

ブラウザで http://localhost:8000/ を開く。

## 公開 (GitHub Pages)

`.github/workflows/pages.yml` が、main への push のたびに Rust のテストと WASM のビルドを行い、`www/` を GitHub Pages に公開する。

最初の 1 回だけ、次の設定が必要。

1. GitHub にこのリポジトリを作り、main を push する。
2. リポジトリの Settings → Pages → Build and deployment の Source を「GitHub Actions」にする。
3. Actions タブで「Deploy to GitHub Pages」が成功したら、`https://<ユーザー名>.github.io/<リポジトリ名>/` で開ける。

ページは相対パスだけで読み込むので、リポジトリ名が変わっても (サブパスでも) そのまま動く。

coopgame の版を上げるときは `cargo update -p coopgame` (または `Cargo.toml` の版を変更) して push する。
早見図の「<版> にはない」の印は、ビルドに使った coopgame の版 (`Cargo.lock` から `build.rs` が読む) で自動的に付け外しされる。

## サンプルコードの更新

「どの解を使う?」のカードに出すサンプルコードは、coopgame の `docs/examples.md` (doctest と pytest で確かめている) から作る。
公開の workflow は、依存している coopgame の版のタグ `v<版>` からこのファイルを取得するので、計算・早見図の印・サンプルコードが同じ版にそろう。
取得できないとき (本体のリポジトリが非公開、タグがない、その版に `docs/examples.md` がない) は、コミット済みの `www/examples.json` を使い、Actions に警告を出す。

```bash
python3 scripts/sync_examples.py --release                       # Cargo.lock の版のタグから取得
python3 scripts/sync_examples.py <coopgame のリポジトリ>/docs/examples.md   # 公開前の版を手元から試す
```

取得元はカードのサンプルコードの下に「出典」として表示する。

## 構成

- `src/lib.rs`: coopgame を呼び、結果を JSON の文字列で返す WASM の入口 (`cargo test` で確かめられる)
- `www/`: 画面。ビルドの手順を持たない素の ES モジュール
  - `app.js`: WASM の読み込みとシーンの切り替え (URL の `#triangle` など)
  - `ui.js`: シーン共通の部品
  - `scenes/*.js`: シーンごとの描画と操作
  - `examples.json`: 早見図のサンプルコード (`scripts/sync_examples.py` で生成)
