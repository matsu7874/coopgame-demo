// タルムードの遺産: 破産問題の配分規則を、遺産 E を動かしながら比べる。
// 横軸は遺産 E (0 から請求の合計まで)、縦軸は各債権者の受取額。選んだ規則について債権者ごとに 1 本の線を引く。
import { h, s, fmt, slider, call, legend, draggable, frame } from "../ui.js";

// 債権者の色。債権者は解の概念ではなく「人」なので、解の色 (COLORS) とは別の意味で
// CSS 変数の色を小さなカテゴリ色の組として使い回す。最大 5 人なので 5 色。
const CREDITOR_COLORS = ["var(--alt1)", "var(--alt2)", "var(--nuc)", "var(--shap)", "var(--kernel)"];
const NAMES = ["A", "B", "C", "D", "E"];

const RULES = [
  { key: "talmud", label: "タルムード則 (仁)", short: "タルムード則" },
  { key: "proportional", label: "比例配分", short: "比例" },
  { key: "cea", label: "CEA (均等に配る)", short: "CEA" },
  { key: "cel", label: "CEL (均等に削る)", short: "CEL" },
  { key: "shapley", label: "Shapley 値", short: "Shapley" },
];

const PRESETS = [
  { label: "タルムード (100, 200, 300)", claims: [100, 200, 300] },
  { label: "4 人 (100, 200, 300, 400)", claims: [100, 200, 300, 400] },
];

const LEAD =
  "破産問題 (英: bankruptcy problem) は、請求の合計に足りない遺産 E を債権者に分ける問題である。" +
  "バビロニア・タルムードは請求 100・200・300 に対して、遺産 100 なら 33⅓ ずつ、200 なら 50・75・75、300 なら 50・100・150 と分けると定めている。" +
  "Aumann と Maschler (1985) は、この分け方 (タルムード則) が破産ゲームの仁 (英: nucleolus) と一致することを示した。";

const SAMPLES = 120;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 5;
const ANIMATION_MS = 4000;

// 図の寸法 (viewBox 座標)。スマホ幅では viewBox を狭くし、文字を相対的に大きくする (F は文字の倍率)。
const M = { left: 52, right: 84, top: 30, bottom: 40 };
let W = 720;
let H = 440;
let F = 1;
let PW = 0;
let PH = 0;
function setLayout(narrow) {
  W = narrow ? 440 : 720;
  H = narrow ? 400 : 440;
  F = narrow ? 1.3 : 1;
  M.left = narrow ? 44 : 52;
  M.right = narrow ? 70 : 84;
  PW = W - M.left - M.right;
  PH = H - M.top - M.bottom;
}
setLayout(false);

export function mount(root, wasm) {
  const { stage, panel } = frame(root, { title: "タルムードの遺産", lead: LEAD });

  const state = {
    claims: [100, 200, 300],
    estate: 200,
    rule: "talmud",
  };

  /** 1 点の計算。全体が失敗した時は各規則を同じ error にする。 */
  function compute(estate, claims) {
    let out;
    try {
      out = call(wasm.bankruptcy, estate, new Float64Array(claims));
    } catch (error) {
      out = { error: String(error) };
    }
    if (out.error) return Object.fromEntries(["lp_nucleolus", ...RULES.map((r) => r.key)].map((k) => [k, { error: out.error }]));
    return out;
  }

  // 曲線用の標本。請求が同じ間は作り直さない (規則を切り替えても再計算しない)。
  let cache = { key: "", samples: [] };
  function samples() {
    const key = state.claims.join(",");
    if (cache.key !== key) {
      const total = sum(state.claims);
      const list = [];
      for (let k = 0; k <= SAMPLES; k += 1) {
        const estate = (total * k) / SAMPLES;
        list.push({ estate, result: compute(estate, state.claims) });
      }
      cache = { key, samples: list };
    }
    return cache.samples;
  }

  // ---- 図 ----
  const svg = s("svg", { role: "img", "aria-label": "遺産 E に対する各債権者の受取額" });
  const gGrid = s("g");
  const gCurves = s("g");
  const gMarker = s("g");
  const markerLine = s("line", { stroke: "var(--ink)", "stroke-width": 1.5 });
  const markerLabel = s("text", { fill: "var(--ink)", "font-weight": 500 });
  // 線は細いので、つかみやすい透明の帯を重ねる
  const markerHit = s("rect", { fill: "transparent", width: 28 });
  const markerHandle = s("path", { fill: "var(--ink)" });
  gMarker.append(markerLine, markerHandle, markerLabel, markerHit);
  const gDots = s("g");
  svg.append(gGrid, gCurves, gMarker, gDots);
  const legendBox = h("div");
  stage.append(svg, legendBox);

  const xOf = (e) => M.left + (sum(state.claims) > 0 ? (e / sum(state.claims)) * PW : 0);
  const yMax = () => Math.max(...state.claims, 1);
  const yOf = (v) => M.top + PH - (v / yMax()) * PH;

  draggable(svg, markerHit, (x) => {
    stopAnimation();
    const total = sum(state.claims);
    const e = clamp(((x - M.left) / PW) * total, 0, total);
    setEstate(Math.round(e));
  });

  // キーボード: 図の目盛り線にもフォーカスでき、矢印キーで動く (スライダーと同じ値)
  markerHit.setAttribute("tabindex", "0");
  markerHit.setAttribute("role", "slider");
  markerHit.setAttribute("aria-label", "遺産 E");
  markerHit.addEventListener("keydown", (event) => {
    const total = sum(state.claims);
    const step = event.shiftKey ? 10 : 1;
    const moves = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: total / 10, PageDown: -total / 10 };
    let next = null;
    if (event.key in moves) next = state.estate + moves[event.key];
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = total;
    if (next == null) return;
    event.preventDefault();
    stopAnimation();
    setEstate(clamp(Math.round(next), 0, total));
  });

  function drawGrid() {
    gGrid.replaceChildren();
    const total = sum(state.claims);
    for (const v of ticks(0, yMax(), 5)) {
      const y = yOf(v);
      gGrid.append(
        s("line", { x1: M.left, x2: M.left + PW, y1: y, y2: y, stroke: "var(--grid)" }),
        s("text", { x: M.left - 8, y: y + 4, "text-anchor": "end", "font-size": 11 * F, fill: "var(--muted)" }, fmt(v)),
      );
    }
    for (const v of ticks(0, total, W < 600 ? 4 : 6)) {
      const x = xOf(v);
      gGrid.append(
        s("line", { x1: x, x2: x, y1: M.top + PH, y2: M.top + PH + 5, stroke: "var(--line)" }),
        s("text", { x, y: M.top + PH + 18, "text-anchor": "middle", "font-size": 11 * F, fill: "var(--muted)" }, fmt(v)),
      );
    }
    gGrid.append(
      s("line", { x1: M.left, x2: M.left + PW, y1: M.top + PH, y2: M.top + PH, stroke: "var(--line)" }),
      s("line", { x1: M.left, x2: M.left, y1: M.top, y2: M.top + PH, stroke: "var(--line)" }),
      s("text", { x: M.left + PW, y: H - 6, "text-anchor": "end", "font-size": 12 * F, fill: "var(--muted)" }, "遺産 E →"),
      s("text", { x: 12, y: M.top + PH / 2, "font-size": 12 * F, fill: "var(--muted)", "text-anchor": "middle", transform: `rotate(-90 12 ${M.top + PH / 2})` }, "受取額"),
    );
    // 請求の半分の水準 (タルムード則で受取額が一度止まる高さ)。目立たせない。
    state.claims.forEach((d, i) => {
      const y = yOf(d / 2);
      gGrid.append(
        s("line", { x1: M.left, x2: M.left + PW, y1: y, y2: y, stroke: CREDITOR_COLORS[i], "stroke-dasharray": "3 5", "stroke-opacity": 0.35 }),
        s("text", { x: M.left + PW + 6, y: y + 3, "font-size": 10 * F, fill: CREDITOR_COLORS[i], "fill-opacity": 0.7 }, `${NAMES[i]} の半分`),
      );
    });
    // 請求が (100, 200, 300) の時は、タルムードに出てくる 3 つの遺産を目盛りで示す
    if (isTalmudPreset()) {
      for (const e of [100, 200, 300]) {
        gGrid.append(s("path", { d: `M${xOf(e)},${M.top + PH - 1} l-4,-7 h8 z`, fill: "var(--muted)", "fill-opacity": 0.6 }));
      }
    }
  }

  function drawCurves() {
    gCurves.replaceChildren();
    const list = samples();
    state.claims.forEach((_, i) => {
      let d = "";
      let pen = false;
      for (const { estate, result } of list) {
        const x = result[state.rule];
        if (!Array.isArray(x)) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"}${xOf(estate).toFixed(2)},${yOf(x[i]).toFixed(2)}`;
        pen = true;
      }
      gCurves.append(s("path", { d, fill: "none", stroke: CREDITOR_COLORS[i], "stroke-width": 2.25, "stroke-linejoin": "round" }));
    });
    legendBox.replaceChildren(
      legend(state.claims.map((d, i) => ({ label: `${NAMES[i]} (請求 ${fmt(d)})`, color: CREDITOR_COLORS[i] }))),
    );
    legendBox.firstChild.style.padding = "6px 8px 2px";
    legendBox.querySelectorAll(".key").forEach((key, i) => setKey(key, CREDITOR_COLORS[i]));
  }

  function drawMarker(result) {
    const x = xOf(state.estate);
    const total = sum(state.claims);
    markerLine.setAttribute("x1", x);
    markerLine.setAttribute("x2", x);
    markerLine.setAttribute("y1", M.top);
    markerLine.setAttribute("y2", M.top + PH);
    // つまみは図の上端。E の値はつまみの横 (右端に近ければ左) に書く
    markerHandle.setAttribute("d", `M${x},${M.top} l-7,-12 h14 z`);
    const labelRight = x < M.left + PW * 0.75;
    markerLabel.setAttribute("x", labelRight ? x + 11 : x - 11);
    markerLabel.setAttribute("y", M.top - 3);
    markerLabel.setAttribute("text-anchor", labelRight ? "start" : "end");
    markerLabel.setAttribute("font-size", 13 * F);
    markerHit.setAttribute("y", M.top - 16);
    markerHit.setAttribute("height", PH + 16);
    markerLabel.textContent = `E = ${fmt(state.estate)}`;
    markerHit.setAttribute("x", x - 14);
    markerHit.setAttribute("aria-valuemin", 0);
    markerHit.setAttribute("aria-valuemax", total);
    markerHit.setAttribute("aria-valuenow", state.estate);

    gDots.replaceChildren();
    const x0 = result[state.rule];
    if (!Array.isArray(x0)) {
      gDots.append(s("text", { x: M.left + 8, y: M.top + 14, "font-size": 12 * F, fill: "var(--bad)" }, `計算できない: ${x0?.error ?? ""}`));
      return;
    }
    // 値ラベルは重ならないように縦方向にずらす
    const items = x0.map((v, i) => ({ i, v, y: yOf(v) })).sort((a, b) => b.y - a.y);
    const gap = 15;
    for (let k = 1; k < items.length; k += 1) items[k].ly = Math.min(items[k].y, (items[k - 1].ly ?? items[k - 1].y) - gap);
    items[0].ly = items[0].y;
    const shift = Math.min(0, (items.at(-1).ly ?? 0) - (M.top + 6));
    const right = x < M.left + PW - 70;
    for (const it of items) {
      const ly = (it.ly ?? it.y) - shift;
      const color = CREDITOR_COLORS[it.i];
      gDots.append(
        s("circle", { cx: x, cy: it.y, r: 5, fill: color, stroke: "var(--surface)", "stroke-width": 1.5 }),
        s(
          "text",
          { x: right ? x + 9 : x - 9, y: ly + 4, "font-size": 12 * F, "font-weight": 500, fill: color, "text-anchor": right ? "start" : "end", "paint-order": "stroke", stroke: "var(--surface)", "stroke-width": 3 },
          `${NAMES[it.i]} ${fmt(it.v)}`,
        ),
      );
    }
  }

  // ---- 操作パネル ----
  const ruleButtons = RULES.map((rule) =>
    h("button", { type: "button", "aria-pressed": String(rule.key === state.rule), onclick: () => setRule(rule.key) }, rule.label),
  );
  function setRule(key) {
    state.rule = key;
    ruleButtons.forEach((b, k) => b.setAttribute("aria-pressed", String(RULES[k].key === key)));
    drawCurves();
    update();
  }

  const estateSlider = slider({
    label: "遺産 E",
    min: 0,
    max: sum(state.claims),
    step: 1,
    value: state.estate,
    onInput: (v) => {
      stopAnimation();
      setEstate(v, { fromSlider: true });
    },
  });

  const playButton = h("button", { type: "button", onclick: togglePlay }, "再生");
  const historyButtons = h(
    "div",
    { class: "buttons" },
    [100, 200, 300].map((e) => h("button", { type: "button", onclick: () => { stopAnimation(); setEstate(e); } }, `E = ${e}`)),
  );
  const historyRow = h("div", {}, h("p", { class: "note", style: { marginBottom: "6px" } }, "タルムードの 3 つの例 (横軸上の小さな三角)"), historyButtons);

  const claimsBox = h("div", { style: { display: "grid", gap: "6px" } });
  const addButton = h("button", { type: "button", onclick: addCreditor }, "債権者を追加");
  const removeButton = h("button", { type: "button", onclick: removeCreditor }, "最後の債権者を削除");
  const presetButtons = PRESETS.map((p) => h("button", { type: "button", onclick: () => setClaims(p.claims, p.claims.length === 3 ? 200 : null) }, p.label));

  const table = h("table", { class: "result" });
  const badge = h("span", { class: "badge" });
  const badgeNote = h("p", { class: "note" });

  panel.append(
    h("div", {}, h("h3", {}, "配分の規則"), h("div", { class: "buttons", role: "group", "aria-label": "配分の規則" }, ruleButtons)),
    h("div", {}, h("h3", {}, "遺産"), estateSlider.row, h("div", { class: "buttons", style: { marginTop: "8px" } }, playButton), historyRow),
    h(
      "div",
      {},
      h("h3", {}, "請求額"),
      claimsBox,
      h("div", { class: "buttons", style: { marginTop: "8px" } }, addButton, removeButton),
      h("div", { class: "buttons", style: { marginTop: "6px" } }, presetButtons),
    ),
    h("div", {}, h("h3", {}, "現在の E での受取額"), h("div", { style: { overflowX: "auto" } }, table)),
    h("div", {}, h("h3", {}, "タルムード則と仁"), badge, badgeNote),
  );

  function renderClaims() {
    claimsBox.replaceChildren(
      ...state.claims.map((d, i) => {
        const id = `talmud-claim-${i}`;
        const input = h("input", { type: "number", id, min: 1, max: 10000, step: 10, value: d });
        input.addEventListener("change", () => {
          const v = Number(input.value);
          if (!(v > 0) || !Number.isFinite(v)) {
            input.value = state.claims[i];
            return;
          }
          const next = state.claims.slice();
          next[i] = v;
          setClaims(next);
        });
        return h(
          "div",
          { class: "control" },
          setKey(h("label", { for: id, class: "key" }, `${NAMES[i]} の請求`), CREDITOR_COLORS[i]),
          input,
          h("span"),
        );
      }),
    );
    addButton.disabled = state.claims.length >= MAX_PLAYERS;
    removeButton.disabled = state.claims.length <= MIN_PLAYERS;
  }

  function addCreditor() {
    if (state.claims.length >= MAX_PLAYERS) return;
    setClaims([...state.claims, Math.max(...state.claims) + 100]);
  }
  function removeCreditor() {
    if (state.claims.length <= MIN_PLAYERS) return;
    setClaims(state.claims.slice(0, -1));
  }

  function setClaims(claims, estate = null) {
    stopAnimation();
    state.claims = claims.slice();
    const total = sum(state.claims);
    state.estate = clamp(estate ?? state.estate, 0, total);
    estateSlider.input.max = total;
    estateSlider.set(state.estate);
    historyRow.hidden = !isTalmudPreset();
    renderClaims();
    drawGrid();
    drawCurves();
    update();
  }

  function setEstate(e, { fromSlider = false } = {}) {
    state.estate = e;
    if (!fromSlider) estateSlider.set(Math.round(e));
    update();
  }

  function isTalmudPreset() {
    return state.claims.join(",") === "100,200,300";
  }

  // ---- 結果 ----
  function update() {
    const result = compute(state.estate, state.claims);
    drawMarker(result);
    renderTable(result);
    renderBadge(result);
  }

  function renderTable(result) {
    const cell = (key, i) => {
      const x = result[key];
      return h("td", {}, Array.isArray(x) ? fmt(x[i]) : "–");
    };
    const errors = RULES.filter((r) => !Array.isArray(result[r.key])).map((r) => `${r.short}: ${result[r.key]?.error}`);
    table.replaceChildren(
      h("thead", {}, h("tr", {}, h("th", {}, "債権者"), h("th", {}, "請求"), RULES.map((r) => h("th", { "aria-current": r.key === state.rule ? "true" : null, style: r.key === state.rule ? { color: "var(--ink)", fontWeight: 700 } : null }, r.short)))),
      h(
        "tbody",
        {},
        state.claims.map((d, i) =>
          h("tr", {}, h("td", {}, setKey(h("span", { class: "key" }, NAMES[i]), CREDITOR_COLORS[i])), h("td", {}, fmt(d)), RULES.map((r) => cell(r.key, i))),
        ),
        h("tr", {}, h("td", { style: { color: "var(--muted)" } }, "合計"), h("td", { style: { color: "var(--muted)" } }, fmt(sum(state.claims))), RULES.map((r) => h("td", { style: { color: "var(--muted)" } }, Array.isArray(result[r.key]) ? fmt(sum(result[r.key])) : "–"))),
      ),
      ...(errors.length ? [h("caption", { style: { captionSide: "bottom", textAlign: "left", color: "var(--bad)", fontSize: "12px", paddingTop: "4px" } }, errors.join(" / "))] : []),
    );
  }

  function renderBadge(result) {
    const here = maxDiff(result.talmud, result.lp_nucleolus);
    let worst = 0;
    let compared = 0;
    for (const { result: r } of samples()) {
      const d = maxDiff(r.talmud, r.lp_nucleolus);
      if (d == null) continue;
      worst = Math.max(worst, d);
      compared += 1;
    }
    if (here == null) {
      badge.className = "badge ng";
      badge.textContent = "比較できない";
      badgeNote.textContent = [result.talmud?.error, result.lp_nucleolus?.error].filter(Boolean).join(" / ");
      return;
    }
    const ok = here < 1e-6;
    badge.className = `badge ${ok ? "ok" : "ng"}`;
    badge.textContent = ok ? `LP で求めた仁と一致 (最大差 ${sci(here)})` : `LP で求めた仁と不一致 (最大差 ${sci(here)})`;
    badgeNote.textContent =
      `タルムード則は閉じた式で、仁は破産ゲームの特性関数を全提携について表にして線形計画法 (英: linear programming, LP) で解いたもの。` +
      `E を 0 から ${fmt(sum(state.claims))} まで ${compared} 点で比べた最大差は ${sci(worst)}。`;
  }

  // ---- 再生 ----
  let animation = null;
  function togglePlay() {
    if (animation) {
      stopAnimation();
      return;
    }
    const total = sum(state.claims);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEstate(total);
      return;
    }
    const start = performance.now();
    playButton.textContent = "停止";
    playButton.setAttribute("aria-pressed", "true");
    const step = (now) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      setEstate(Math.round(t * total));
      if (t < 1) animation = requestAnimationFrame(step);
      else stopAnimation();
    };
    animation = requestAnimationFrame(step);
  }
  function stopAnimation() {
    if (animation) cancelAnimationFrame(animation);
    animation = null;
    playButton.textContent = "再生";
    playButton.removeAttribute("aria-pressed");
  }

  // 図の幅に合わせて viewBox を切り替える
  let narrow = null;
  function relayout() {
    const next = stage.clientWidth > 0 && stage.clientWidth < 560;
    if (next === narrow) return;
    narrow = next;
    setLayout(narrow);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    drawGrid();
    drawCurves();
    update();
  }
  new ResizeObserver(relayout).observe(stage);

  setClaims(state.claims, state.estate);
  relayout();
}

/** 色見本 (.key) の色を CSS 変数で指定する。style オブジェクトへの代入ではカスタムプロパティが効かないため。 */
function setKey(node, color) {
  node.style.setProperty("--key", color);
  return node;
}


function sum(xs) {
  return xs.reduce((a, b) => a + b, 0);
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

function maxDiff(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return null;
  return Math.max(0, ...a.map((x, i) => Math.abs(x - b[i])));
}

function sci(x) {
  return x === 0 ? "0" : x.toExponential(1);
}

/** 0 から max までのきりのよい目盛り。 */
function ticks(min, max, count) {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw);
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}
