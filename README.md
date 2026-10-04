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

## 構成

- `src/lib.rs`: coopgame を呼び、結果を JSON の文字列で返す WASM の入口 (`cargo test` で確かめられる)
- `www/`: 画面。ビルドの手順を持たない素の ES モジュール
  - `app.js`: WASM の読み込みとシーンの切り替え (URL の `#triangle` など)
  - `ui.js`: シーン共通の部品
  - `scenes/*.js`: シーンごとの描画と操作
