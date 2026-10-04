// 知りたいことから解 (指標) を選ぶ早見図。質問に答えると道筋が伸び、最後に使う解と関数を示す。
// 「全体図」では木全体を一覧できる。coopgame の docs/choosing.md の早見図に対応する。
// WASM は使わない (計算をしないシーン)。

import { h } from "../ui.js";

// ---- 解の説明 ----
// next: crates.io の 0.1.0 にはなく、次の版で追加される機能。
const SOLUTIONS = {
  nucleolus: {
    name: "仁",
    what: "最も不満の大きい提携の不満 (超過 v(S) − x(S)) を最小にし、同点なら次に大きい不満を最小にする配分。コアが空でなければコアに入る。",
    rust: "nucleolus::nucleolus",
    cli: "coopgame nucleolus v.txt",
    py: "coopgame.nucleolus(game)",
    demo: "triangle",
  },
  leastCore: {
    name: "最小コア",
    what: "全ての提携の不満を ε 以下に抑えられる最小の ε と、それを達成する配分。コアが空のとき、どこまで不満を抑えられるかが分かる。",
    rust: "nucleolus::least_core",
    cli: "coopgame least-core v.txt",
    py: "coopgame.least_core(game)",
  },
  coreCheck: {
    name: "コアが空でないかの判定",
    what: "誰も抜けたくならない分け方 (コア) があるかを LP で判定する。凸ゲームならコアは空でなく、Shapley 値もコアに入る。",
    rust: "properties::{has_nonempty_core, is_convex}",
    py: "game.has_nonempty_core()、game.is_convex()",
  },
  shapley: {
    name: "Shapley 値",
    what: "参加する順番を一様に選んだときの、各人の限界貢献の期待値。効率性・対称性・ナルプレイヤー・加法性を満たす唯一の値。凸ゲームではコアに入る。",
    rust: "values::shapley",
    cli: "coopgame shapley v.txt",
    py: "coopgame.shapley(game)",
    demo: "triangle",
  },
  banzhaf: {
    name: "Banzhaf 値",
    what: "他の人のあらゆる組み合わせを同じ確率としたときの、限界貢献の平均。和は v(N) になるとは限らない。",
    rust: "values::banzhaf",
    cli: "coopgame banzhaf v.txt",
    py: "coopgame.banzhaf(game)",
  },
  solidarity: {
    name: "solidarity 値",
    what: "Shapley 値の限界貢献を、提携のメンバーの限界貢献の平均に置き換えた値。貢献しない人 (ナルプレイヤー) にも正の額が分けられることがある。",
    rust: "values::solidarity",
    cli: "coopgame solidarity v.txt",
    py: "coopgame.solidarity(game)",
    next: true,
  },
  tau: {
    name: "tau 値",
    what: "各人の取り分の上限 (理想の支払い M_i = v(N) − v(N∖{i})) と下限 (最小の権利) を結ぶ線分上で、和が v(N) になる点。準平衡なゲームだけで定義される。",
    rust: "compromise::tau_value",
    cli: "coopgame tau v.txt",
    py: "coopgame.tau_value(game)",
    next: true,
  },
  gately: {
    name: "Gately 点",
    what: "各人の「抜けたときに他の人が失う額 ÷ 自分が失う額」(抜ける傾向) を全員で等しくする配分。",
    rust: "compromise::gately_point",
    cli: "coopgame gately v.txt",
    py: "coopgame.gately_point(game)",
    next: true,
  },
  disruption: {
    name: "disruption nucleolus",
    what: "提携ごとの抜ける傾向を、大きい順に辞書式に小さくするコアの点。コアが空でないゲームだけで定義される。",
    rust: "variants::disruption_nucleolus",
    cli: "coopgame disruption v.txt",
    py: "coopgame.disruption_nucleolus(game)",
    next: true,
  },
  perCapita: {
    name: "per capita 仁",
    what: "不満を提携の人数で割ってから、仁と同じように辞書式に最小化する。人数の多い提携の不満を軽く見る。",
    rust: "variants::per_capita_nucleolus",
    cli: "coopgame per-capita v.txt",
    py: "coopgame.per_capita_nucleolus(game)",
  },
  proportional: {
    name: "比例仁",
    what: "不満を提携の値で割ってから辞書式に最小化する。値の大きい提携の不満を軽く見る。非負のゲームだけ。",
    rust: "variants::proportional_nucleolus",
    cli: "coopgame proportional v.txt",
    py: "coopgame.proportional_nucleolus(game)",
  },
  modiclus: {
    name: "modiclus",
    what: "2 つの提携の不満の差を全ての組について並べ、辞書式に最小化する。7 人まで。",
    rust: "variants::modiclus",
    cli: "coopgame modiclus v.txt",
    py: "coopgame.modiclus(game)",
  },
  anti: {
    name: "anti-nucleolus",
    what: "不満を小さい順に並べ、辞書式に最大化する。最も得をしている提携の余裕を小さくする。双対ゲームの仁として求める。",
    rust: "variants::{anti_nucleolus, anti_prenucleolus}",
    cli: "coopgame anti-nucleolus v.txt",
    py: "coopgame.anti_nucleolus(game)",
    next: true,
  },
  kernel: {
    name: "カーネル",
    what: "どの 2 人の間でも、相手を除いて組んだときに得られる最大の余り (最大余剰) が釣り合う配分の集合。仁を含む。",
    rust: "kernel::kernel_point、kernel_set::kernel_set",
    cli: "coopgame kernel v.txt",
    py: "coopgame.kernel_point(game)",
    demo: "triangle",
  },
  talmud: {
    name: "タルムード則",
    what: "請求の半分を境に、遺産が少ないうちは均等に配り、多くなると請求から均等に削る規則。破産ゲームの仁に一致する。",
    rust: "bankruptcy::talmud_rule",
    cli: "coopgame talmud --estate 200 --claims 100,200,300",
    py: "coopgame.talmud(estate, claims)",
    demo: "talmud",
  },
  ceaCel: {
    name: "CEA・CEL",
    what: "CEA は請求を上限に全員へ均等に配る。CEL は全員の請求から均等に削る。",
    rust: "bankruptcy::{constrained_equal_awards, constrained_equal_losses}",
    py: "coopgame.constrained_equal_awards(estate, claims)",
    demo: "talmud",
  },
  airport: {
    name: "空港ゲームの Shapley 値・仁",
    what: "Shapley 値は、費用の増分をそれを必要とする人数で等分した和になる。仁は凸ゲームの手法で全提携を列挙せずに求める。",
    rust: "oracle::airport::AirportGame",
    cli: "coopgame airport --costs 1,2,3,6",
    py: "coopgame.airport(costs)",
  },
  bird: {
    name: "Bird 規則",
    what: "供給元から最小全域木をたどり、各人が自分を木につなぐ辺の費用を払う。この分け方はコアに入る。仁と Shapley 値も比べられる。",
    rust: "oracle::spanning_tree::SpanningTreeGame",
    py: "coopgame.spanning_tree(costs)",
    demo: "water",
  },
  production: {
    name: "線形生産ゲームの配分",
    what: "資源の価値を双対 LP の影の価格で評価し、持ち寄った資源に応じて分ける。この分け方はコアに入る。",
    rust: "oracle::production::LinearProductionGame",
    py: "coopgame.linear_production(...)",
  },
  cost: {
    name: "費用の仁・Shapley 値",
    what: "費用 c(S) を節約額のゲームに直して仁を求め、費用の分担に戻す。Shapley 値は費用のゲームにそのまま使える。",
    rust: "cost::CostGame",
    cli: "coopgame nucleolus v.txt --cost",
    py: "coopgame.cost_nucleolus(game)",
  },
  myerson: {
    name: "Myerson 値",
    what: "協力できる相手を無向グラフで決め、つながった人どうしだけで協力するゲームの Shapley 値をとる。",
    rust: "communication::myerson",
    cli: "coopgame myerson v.txt --edges 1-2,2-3",
    py: "coopgame.myerson(game, edges)",
    next: true,
  },
  structure: {
    name: "Aumann–Drèze 値・Owen 値・提携構造つきの仁",
    what: "グループごとに別々に協力するなら Aumann–Drèze 値 (グループ内の Shapley 値) や提携構造つきの仁。全員で協力しつつグループ単位で交渉するなら Owen 値。",
    rust: "partition::{aumann_dreze, owen, nucleolus}",
    cli: "coopgame structure v.txt --blocks \"1,2|3,4\"",
    py: "coopgame.aumann_dreze(game, blocks)",
  },
  shapleyShubik: {
    name: "Shapley–Shubik 指数",
    what: "賛成者が 1 人ずつ加わる順番を一様に選んだとき、その人の賛成で可決に届く確率。",
    rust: "values::shapley",
    cli: "coopgame shapley v.txt",
    py: "coopgame.shapley(game)",
    demo: "voting",
  },
  banzhafIndex: {
    name: "Banzhaf 指数",
    what: "その人が抜けると否決になる勝利提携 (決定票を持つ提携) の数を、全員の合計が 1 になるよう割った指数。",
    rust: "values::{banzhaf, normalize}",
    cli: "coopgame banzhaf v.txt --normalize",
    py: "coopgame.normalize(coopgame.banzhaf(game))",
    demo: "voting",
  },
  johnston: {
    name: "Johnston 指数",
    what: "勝利提携ごとに、決定票を持つ人で 1 を等分し、全員の合計が 1 になるよう割った指数。",
    rust: "power::SimpleGame::johnston",
    cli: "coopgame power v.txt",
    py: "coopgame.power_indices(game)",
    next: true,
  },
  deeganPackel: {
    name: "Deegan–Packel 指数",
    what: "最小勝利提携を一様に 1 つ選び、そのメンバーで等分したときの期待値。",
    rust: "power::SimpleGame::deegan_packel",
    cli: "coopgame power v.txt",
    py: "coopgame.power_indices(game)",
    next: true,
  },
  publicGood: {
    name: "Public Good 指数 (Holler 指数)",
    what: "その人を含む最小勝利提携の数を、全員の合計が 1 になるよう割った指数。重みの大きい党ほど大きいとは限らない。",
    rust: "power::SimpleGame::public_good",
    cli: "coopgame power v.txt",
    py: "coopgame.power_indices(game)",
    next: true,
  },
  coleman: {
    name: "Coleman の阻止力・発議力",
    what: "阻止力は、勝利提携のうちその人が抜けると否決になる割合。発議力は、敗北提携のうちその人が加わると可決になる割合。",
    rust: "power::SimpleGame::{coleman_prevent, coleman_initiative}",
    cli: "coopgame power v.txt",
    py: "coopgame.power_indices(game)",
    next: true,
  },
  collectivity: {
    name: "Coleman の集団の行動力",
    what: "全ての提携のうち勝利提携の割合。議会全体として可決しやすい規則かを表す。",
    rust: "power::SimpleGame::coleman_collectivity",
    cli: "coopgame power v.txt",
    py: "coopgame.power_indices(game)",
    next: true,
  },
  inCore: {
    name: "コアに入るか・不満の大きい提携",
    what: "配分がコアに入るか、どの提携がどれだけ不満か (超過の大きい順)、プレイヤーごとの最も不満な提携を示す。複数の配分を安定性で比べられる。",
    rust: "properties::is_in_core、explain::{report, compare}",
    cli: "coopgame explain v.txt sol.txt",
    py: "coopgame.explain(game, x)",
  },
  certify: {
    name: "仁であることの検証",
    what: "Kohlberg 基準で、配分が仁 (プレ仁) であるかを判定する。有理数による厳密な検証もできる。",
    rust: "kohlberg::verify、exact::certify",
    cli: "coopgame certify v.txt sol.txt",
    py: "coopgame.certify(game, x)",
  },
  bargaining: {
    name: "交渉集合に入るか",
    what: "ある人が別の人に異議を唱えたとき、相手が反論できるかを全ての組で調べる。反論できない異議があればその支払いを返す。",
    rust: "bargaining::check",
    cli: "coopgame bargaining v.txt sol.txt",
    py: "coopgame.bargaining_set(game, x)",
  },
  uncertainty: {
    name: "値が不確かなときの配分の揺れ",
    what: "提携の値の分布や区間から配分の分布を求め、どの提携の値が配分を決めているかを感度で示す。",
    rust: "uncertainty::{monte_carlo, influence}",
    cli: "coopgame uncertainty v.txt --relative 0.1",
    py: "coopgame.uncertainty(game, relative=0.1)",
  },
};

// ---- 質問の木 ----
const MIN_WINNING = {
  q: "最小勝利提携の中で、力をどう数えるか",
  options: [
    { label: "メンバーで等分する", result: ["deeganPackel"] },
    { label: "入っている回数で数える", result: ["publicGood"] },
  ],
};

const OTHER = {
  q: "何を均すか",
  options: [
    { label: "各人の取り分の上限と下限の妥協", result: ["tau"] },
    { label: "抜ける傾向を全員で等しく", result: ["gately"] },
    { label: "提携の抜ける傾向を辞書式に小さく", result: ["disruption"] },
    { label: "不満を提携の人数で割って比べる", result: ["perCapita"] },
    { label: "不満を提携の値で割って比べる", result: ["proportional"] },
    { label: "提携どうしの不満の差を小さく", result: ["modiclus"] },
    { label: "最も得をしている提携の得を小さく", result: ["anti"] },
    { label: "どの 2 人の間でも文句が釣り合う", result: ["kernel"] },
  ],
};

const CONTRIBUTION = {
  q: "全員の取り分の和を v(N) に合わせるか",
  options: [
    {
      label: "合わせる",
      next: {
        q: "貢献の少ない人にも分けるか",
        options: [
          { label: "分けない (限界貢献だけで決める)", result: ["shapley"] },
          { label: "分ける", result: ["solidarity"] },
        ],
      },
    },
    { label: "合わせない (各人の影響力だけを見る)", result: ["banzhaf"] },
  ],
};

const STABILITY = {
  q: "誰も抜けたくならない分け方 (コア) はあるか",
  options: [
    { label: "ある", result: ["nucleolus", "kernel"] },
    { label: "ない", result: ["leastCore", "nucleolus"] },
    { label: "分からない", result: ["coreCheck", "nucleolus"] },
  ],
};

const TREE = {
  q: "何を知りたいか",
  options: [
    {
      label: "協力で得た利益・費用をどう分けるか",
      next: {
        q: "よく知られた構造のゲームか",
        options: [
          { label: "請求の合計に足りない額を分ける (破産問題)", result: ["talmud", "ceaCel"] },
          { label: "最も大きい要求に合わせて作る設備の費用 (空港ゲーム)", result: ["airport"] },
          { label: "供給元から全員をつなぐ費用 (最小全域木ゲーム)", result: ["bird"] },
          { label: "資源を持ち寄って生産する (線形生産ゲーム)", result: ["production"] },
          { label: "協力できる相手がグラフで決まる", result: ["myerson"] },
          { label: "先にグループに分かれている", result: ["structure"] },
          {
            label: "どれでもない",
            next: {
              q: "何を重視するか",
              options: [
                { label: "誰も抜けたくならないこと", next: STABILITY },
                { label: "貢献に応じること", next: CONTRIBUTION },
                { label: "費用を分ける (利益ではなく)", result: ["cost"] },
                { label: "その他の公平さ", next: OTHER },
              ],
            },
          },
        ],
      },
    },
    {
      label: "投票で誰がどれだけ結果を左右できるか",
      next: {
        q: "どんな連立の作られ方を想定するか",
        options: [
          { label: "賛成者が 1 人ずつ加わっていく", result: ["shapleyShubik"] },
          { label: "どの組み合わせも同じ確率", result: ["banzhafIndex"] },
          { label: "余分な党を含まない最小の連立だけ", next: MIN_WINNING },
          { label: "決定票を持つ人で等分する", result: ["johnston"] },
          { label: "否決させる力と可決させる力を分けて見る", result: ["coleman"] },
          { label: "議会全体として決めやすいか", result: ["collectivity"] },
        ],
      },
    },
    {
      label: "手元の分け方が安定か・正しいか",
      next: {
        q: "何を確かめるか",
        options: [
          { label: "誰も抜けたくならないか、誰が不満か", result: ["inCore"] },
          { label: "本当に仁か (証明つき)", result: ["certify"] },
          { label: "異議に反論できるか (交渉集合)", result: ["bargaining"] },
          { label: "値が不確かなとき配分がどれだけ揺れるか", result: ["uncertainty"] },
        ],
      },
    },
  ],
};

const DEMO_LABELS = { triangle: "3 人の分け前", talmud: "タルムードの遺産", voting: "議会の投票力", water: "水道管の費用" };

const STYLE = `
.gd-view { display: flex; gap: 6px; margin-bottom: 16px; }
.gd-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start; }
@media (max-width: 860px) { .gd-body { grid-template-columns: minmax(0, 1fr); } }
.gd-steps { display: flex; flex-direction: column; }
.gd-step { position: relative; padding: 0 0 18px 28px; }
.gd-step::before { content: ""; position: absolute; left: 9px; top: 22px; bottom: 0; width: 2px; background: var(--line); }
.gd-step:last-child::before { display: none; }
.gd-dot { position: absolute; left: 0; top: 3px; width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--ink); background: var(--surface); font-size: 11px; font-weight: 700; display: grid; place-items: center; }
.gd-step h3 { font-family: var(--serif); font-weight: 600; font-size: 17px; margin: 0 0 8px; }
.gd-options { display: flex; flex-direction: column; gap: 4px; }
.gd-options button { text-align: left; font-size: 14px; padding: 6px 10px; }
.gd-options button[aria-pressed="false"].gd-faded { opacity: 0.45; }
.gd-results { display: flex; flex-direction: column; gap: 12px; }
@media (min-width: 861px) { .gd-body > div:last-child { position: sticky; top: 16px; } }
.gd-empty { color: var(--muted); border: 1px dashed var(--line); border-radius: 6px; padding: 16px; }
.gd-card { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--nuc); border-radius: 6px; padding: 12px 14px; }
.gd-card h4 { margin: 0 0 4px; font-size: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.gd-card p { margin: 0 0 8px; font-size: 14px; }
.gd-card dl { display: grid; grid-template-columns: 4.5em minmax(0, 1fr); gap: 2px 8px; margin: 0; font-size: 12.5px; }
.gd-card dt { color: var(--muted); }
.gd-card dd { margin: 0; overflow-wrap: anywhere; }
.gd-card code { font-size: 12.5px; }
.gd-next { font-size: 11px; font-weight: 500; color: var(--alt1); border: 1px solid currentColor; border-radius: 999px; padding: 0 8px; }
.gd-card a.gd-demo { font-size: 13px; display: inline-block; margin-top: 8px; }
.gd-map ul { list-style: none; margin: 0; padding-left: 18px; border-left: 1px solid var(--line); }
.gd-map > ul { border-left: 0; padding-left: 0; }
.gd-map li { margin: 4px 0; }
.gd-map .gd-q { font-family: var(--serif); font-weight: 600; }
.gd-map .gd-a { color: var(--muted); font-size: 14px; }
.gd-map .gd-leaf { display: inline-flex; flex-wrap: wrap; gap: 4px; margin-left: 6px; }
.gd-map .gd-leaf button { font-size: 12.5px; padding: 1px 8px; border-color: var(--nuc); color: var(--nuc); }
`;

export function mount(root) {
  root.append(h("style", {}, STYLE));
  root.append(
    h("div", { class: "scene-head" },
      h("h2", {}, "どの解を使う?"),
      h("p", {}, "知りたいことに答えていくと、使う解 (指標) と、coopgame の関数・CLI・Python の呼び方を示す。「全体図」では選択肢を一覧できる。「次の版で追加」の印は、crates.io の 0.1.0 にはまだない機能である。"),
    ),
  );

  const modeFlow = h("button", { type: "button", "aria-pressed": "true", onclick: () => setMode("flow") }, "質問に答える");
  const modeMap = h("button", { type: "button", "aria-pressed": "false", onclick: () => setMode("map") }, "全体図");
  const reset = h("button", { type: "button", onclick: () => { path.length = 0; render(); } }, "最初から");
  root.append(h("div", { class: "gd-view" }, modeFlow, modeMap, reset));

  const left = h("div", {});
  const results = h("div", { class: "gd-results", "aria-live": "polite" });
  root.append(h("div", { class: "gd-body" }, left, h("div", {}, h("h3", { class: "visually-hidden" }, "使う解"), results)));

  let mode = "flow";
  const path = []; // 選んだ選択肢の番号の列
  let mapSelection = null; // 全体図で選んだ解の一覧

  function setMode(next) {
    mode = next;
    modeFlow.setAttribute("aria-pressed", String(mode === "flow"));
    modeMap.setAttribute("aria-pressed", String(mode === "map"));
    reset.hidden = mode !== "flow";
    render();
  }

  function render() {
    left.replaceChildren(mode === "flow" ? renderSteps() : renderMap());
    const ids = mode === "flow" ? currentResult() : mapSelection;
    results.replaceChildren(...(ids ? ids.map(card) : [h("p", { class: "gd-empty" }, mode === "flow" ? "左の質問に答えると、ここに使う解が出る。" : "全体図の解の名前を押すと、ここに説明が出る。")]));
  }

  function currentResult() {
    let node = TREE;
    for (const index of path) {
      const option = node.options[index];
      if (option.result) return option.result;
      node = option.next;
    }
    return null;
  }

  function renderSteps() {
    const steps = h("div", { class: "gd-steps" });
    let node = TREE;
    let depth = 0;
    while (node) {
      const current = node;
      const level = depth;
      const chosen = path[level];
      const options = current.options.map((option, index) =>
        h("button", {
          type: "button",
          "aria-pressed": String(chosen === index),
          class: chosen != null && chosen !== index ? "gd-faded" : null,
          onclick: () => {
            path.length = level;
            path.push(index);
            render();
            // 狭い画面では結果が質問の下に来るので、結果が出たらそこまで送る。
            if (currentResult() && matchMedia("(max-width: 860px)").matches) {
              const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
              results.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
            }
          },
        }, option.label),
      );
      steps.append(
        h("div", { class: "gd-step" },
          h("span", { class: "gd-dot", "aria-hidden": "true" }, String(level + 1)),
          h("h3", {}, current.q),
          h("div", { class: "gd-options", role: "group", "aria-label": current.q }, options),
        ),
      );
      if (chosen == null) break;
      const option = current.options[chosen];
      node = option.next ?? null;
      depth += 1;
    }
    return steps;
  }

  function renderMap() {
    const walk = (node) =>
      h("ul", {},
        h("li", {}, h("span", { class: "gd-q" }, node.q)),
        node.options.map((option) =>
          h("li", {},
            h("span", { class: "gd-a" }, option.label),
            option.result
              ? h("span", { class: "gd-leaf" }, option.result.map((id) =>
                  h("button", { type: "button", onclick: () => { mapSelection = option.result; render(); } }, SOLUTIONS[id].name)))
              : walk(option.next),
          ),
        ),
      );
    return h("div", { class: "gd-map" }, walk(TREE));
  }

  function card(id) {
    const s = SOLUTIONS[id];
    const rows = [
      ["Rust", s.rust && `coopgame::${s.rust}`],
      ["CLI", s.cli],
      ["Python", s.py],
    ].filter(([, v]) => v);
    return h("article", { class: "gd-card" },
      h("h4", {}, s.name, s.next ? h("span", { class: "gd-next" }, "次の版で追加") : null),
      h("p", {}, s.what),
      h("dl", {}, rows.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, h("code", {}, v))])),
      s.demo ? h("a", { class: "gd-demo", href: `#${s.demo}` }, `「${DEMO_LABELS[s.demo]}」で動かす`) : null,
    );
  }

  render();
}
