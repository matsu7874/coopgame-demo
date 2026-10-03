// 議会の投票力: 議席の割合と、採決を左右する力 (Shapley–Shubik 指数・Banzhaf 指数・仁) を並べて比べる。
import { h, s, fmt, slider, call, COLORS, legend, svgPoint, frame } from "../ui.js";

const MIN_PARTIES = 2;
// 15 党 (提携 2^15 個) でも計算は 200 ms 未満に収まるので、国連安保理のプリセットまで同じ上限で扱う。
const MAX_PARTIES = 15;
const MAX_SEATS = 200;
const NAMES = "ABCDEFGHIJKLMNO".split("").map((c) => `${c}党`);

// 党の色。解の色 (CSS 変数) を土台に、--ink との混色で濃淡を足す。明暗どちらのテーマでも変数が切り替わる。
const BASE = ["var(--nuc)", "var(--alt1)", "var(--alt2)", "var(--kernel)", "var(--shap)", "var(--core)"];
const PALETTE = [
  ...BASE,
  ...BASE.map((c) => `color-mix(in oklab, ${c} 55%, var(--ink))`),
  "color-mix(in oklab, var(--alt1) 50%, var(--kernel))",
  "color-mix(in oklab, var(--nuc) 50%, var(--core))",
  "var(--alt3)",
];
const partyColor = (i) => PALETTE[i % PALETTE.length];

const METRICS = [
  { key: "share", label: "議席の割合", color: "var(--muted)" },
  { key: "shapley_shubik", label: "Shapley–Shubik 指数", color: COLORS.shapley },
  { key: "banzhaf", label: "Banzhaf 指数 (正規化)", color: "var(--alt2)" },
  { key: "nucleolus", label: "仁 (英: nucleolus)", color: COLORS.nucleolus },
];

const majority = (total) => Math.floor(total / 2) + 1;
const PRESETS = [
  {
    id: "eec",
    label: "EEC 閣僚理事会 1958",
    names: ["フランス", "西ドイツ", "イタリア", "ベルギー", "オランダ", "ルクセンブルク"],
    seats: [4, 4, 4, 2, 2, 1],
    quota: 12,
    note: "重み 4・4・4・2・2・1、可決に 12 票。ルクセンブルク (1 票) が加わって結果が変わる提携は 1 つもない。",
  },
  {
    id: "three",
    label: "3 党で過半数争い",
    names: ["A党", "B党", "C党"],
    seats: [49, 49, 2],
    quota: null,
    note: "49・49・2 議席、過半数 51。どの 2 党でも過半数になるので、2 議席の党も大きな党と同じ力を持つ。",
  },
  {
    id: "unsc",
    label: "国連安保理",
    names: ["米国", "英国", "フランス", "ロシア", "中国", ...Array.from({ length: 10 }, (_, i) => `非常任${i + 1}`)],
    seats: [7, 7, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    quota: 39,
    note: "常任理事国 5 (重み 7)、非常任理事国 10 (重み 1)、可決に 39。常任 5 か国すべてと非常任 4 か国の賛成が要る、という拒否権つきの規則を重みで表したもの。",
  },
];

const LEAD =
  "議席の割合と、採決を左右する力は一致しない。重み付き投票ゲーム (英: weighted voting game) では、" +
  "ある党が抜けると可決が否決に変わる場面がどれだけあるかで力を測る。" +
  "Shapley–Shubik 指数は、党が 1 つずつ賛成に加わる順番のうち、その党の賛成で可決に届く順番の割合である。" +
  "Banzhaf 指数は、その党が決定票 (英: swing) を持つ提携の数を全党で合計 1 になるよう割ったもの。" +
  "議席や可決に必要な票数を動かして比べる。";

const STYLE = `
.scene[data-scene="voting"] .vt-chart .vt-bar { transition: width .25s ease; }
.scene[data-scene="voting"] .vt-chart .vt-move { transition: transform .25s ease; }
.scene[data-scene="voting"] .vt-chart.dragging .vt-bar,
.scene[data-scene="voting"] .vt-chart.dragging .vt-move { transition: none; }
.scene[data-scene="voting"] .vt-handle { cursor: ew-resize; }
.scene[data-scene="voting"] .vt-handle:focus { outline: none; }
.scene[data-scene="voting"] .vt-handle:focus-visible rect { stroke: var(--nuc); stroke-width: 3; }
.scene[data-scene="voting"] .stage .legend { padding: 4px 8px 0; }
.scene[data-scene="voting"] .vt-parties { display: flex; flex-direction: column; gap: 6px; }
.scene[data-scene="voting"] .vt-party {
  display: grid; grid-template-columns: 12px minmax(0, 1fr) 2.2em 4.5em 2.2em 2.2em; gap: 6px; align-items: center;
}
.scene[data-scene="voting"] .vt-party button { padding: 2px 0; }
.scene[data-scene="voting"] .vt-party input[type="text"] {
  width: 100%; min-width: 0; font: inherit; font-size: 13px; color: var(--ink); background: var(--surface);
  border: 1px solid var(--line); border-radius: 4px; padding: 2px 6px;
}
.scene[data-scene="voting"] .vt-swatch { width: 12px; height: 12px; border-radius: 50%; }
.scene[data-scene="voting"] .vt-table { overflow-x: auto; }
.scene[data-scene="voting"] .vt-table th, .scene[data-scene="voting"] .vt-table td:not(:first-child) { white-space: nowrap; }
.scene[data-scene="voting"] .vt-table .badge { margin-left: 4px; font-size: 11px; }
.scene[data-scene="voting"] .vt-mwc { margin: 0; padding-left: 1.4em; font-size: 13px; }
.scene[data-scene="voting"] .vt-sub { display: flex; flex-direction: column; gap: 8px; }
.scene[data-scene="voting"] .vt-swing-note { margin-top: 6px; }
`;

export function mount(root, wasm) {
  root.append(h("style", {}, STYLE));
  const { stage, panel } = frame(root, { title: "議会の投票力", lead: LEAD });

  const state = { names: [], seats: [], quota: 1, followMajority: true, preset: null };
  let result = null;
  let elapsed = 0;
  let axisLock = null;
  let width = 0;
  let view = null; // build() が作る SVG 要素への参照

  // ---- 図 ----
  const hemiSvg = s("svg", { role: "img" });
  const chartSvg = s("svg", { class: "vt-chart", role: "group", "aria-label": "党ごとの議席の割合と投票力の棒グラフ" });
  stage.append(hemiSvg, legend(METRICS.map(({ label, color }) => ({ label, color }))), chartSvg);

  // ---- パネル ----
  const presetButtons = PRESETS.map((p) =>
    h("button", { type: "button", "aria-pressed": "false", onclick: () => applyPreset(p) }, p.label),
  );
  const presetNote = h("p", { class: "note" });

  const quotaSlider = slider({
    label: "可決に必要な票",
    min: 1,
    max: 100,
    value: 51,
    format: (v) => `${v} 票`,
    onInput: (v) => {
      state.quota = v;
      state.followMajority = v === majority(total());
      state.preset = null;
      schedule();
    },
  });
  const quotaButtons = [
    ["過半数", (t) => majority(t), true],
    ["3 分の 2", (t) => Math.ceil((2 * t) / 3), false],
    ["全会一致", (t) => t, false],
  ].map(([label, rule, follow]) =>
    h("button", {
      type: "button",
      onclick: () => {
        state.quota = rule(total());
        state.followMajority = follow;
        state.preset = null;
        schedule();
      },
    }, label),
  );
  const quotaInfo = h("p", { class: "note" });

  const partyList = h("div", { class: "vt-parties" });
  const addButton = h("button", { type: "button", onclick: addParty }, "党を追加");

  const tableBody = h("tbody");
  const table = h("div", { class: "vt-table" },
    h("table", { class: "result" },
      h("thead", {}, h("tr", {},
        h("th", { scope: "col" }, "党"),
        h("th", { scope: "col" }, "議席"),
        h("th", { scope: "col" }, "割合"),
        h("th", { scope: "col", title: "Shapley–Shubik 指数" }, "S–S"),
        h("th", { scope: "col", title: "Banzhaf 指数 (正規化)" }, "Bz"),
        h("th", { scope: "col" }, "仁"),
        h("th", { scope: "col", title: "その党が抜けると否決に変わる勝利提携の数" }, "決定票"),
      )),
      tableBody,
    ),
  );
  const tableNote = h("p", { class: "note vt-swing-note" });
  const vetoNote = h("p", { class: "note" });
  const errorNote = h("p", { class: "error", hidden: true });

  const mwcHead = h("h3", {}, "最小勝利提携");
  const mwcList = h("ul", { class: "vt-mwc" });
  const mwcNote = h("p", { class: "note" });
  const timing = h("p", { class: "note" });

  panel.append(
    h("div", { class: "vt-sub" }, h("h3", {}, "例"), h("div", { class: "buttons" }, presetButtons), presetNote),
    h("div", { class: "vt-sub" }, h("h3", {}, "可決の基準"), quotaSlider.row, h("div", { class: "buttons" }, quotaButtons), quotaInfo),
    h("div", { class: "vt-sub" },
      h("h3", {}, "党と議席"),
      h("p", { class: "note" }, "棒グラフの灰色の棒の端をドラッグしても議席を変えられる。"),
      partyList,
      h("div", { class: "buttons" }, addButton),
    ),
    h("div", {}, h("h3", {}, "投票力"), errorNote, table, tableNote, vetoNote),
    h("div", {}, mwcHead, mwcNote, mwcList),
    timing,
  );
  tableNote.textContent =
    "S–S は Shapley–Shubik 指数、Bz は Banzhaf 指数 (合計 1 に正規化)。決定票は、その党が抜けると可決が否決に変わる勝利提携の数。";

  function total() {
    return state.seats.reduce((a, b) => a + b, 0);
  }

  // ---- 状態の変更 ----
  function applyPreset(p) {
    state.names = [...p.names];
    state.seats = [...p.seats];
    state.quota = p.quota ?? majority(total());
    state.followMajority = p.quota == null || p.quota === majority(total());
    state.preset = p.id;
    rebuildParties();
    schedule();
  }

  function setSeats(i, v) {
    const seats = Math.max(1, Math.min(MAX_SEATS, Math.round(v)));
    if (seats === state.seats[i]) return;
    state.seats[i] = seats;
    state.preset = null;
    schedule();
  }

  function addParty() {
    if (state.seats.length >= MAX_PARTIES) return;
    const used = new Set(state.names);
    state.names.push(NAMES.find((n) => !used.has(n)) ?? `${state.names.length + 1}党`);
    state.seats.push(5);
    state.preset = null;
    rebuildParties();
    schedule();
  }

  function removeParty(i) {
    if (state.seats.length <= MIN_PARTIES) return;
    state.names.splice(i, 1);
    state.seats.splice(i, 1);
    state.preset = null;
    rebuildParties();
    schedule();
  }

  // ---- 党の編集欄 ----
  let partyRows = [];
  function rebuildParties() {
    partyList.replaceChildren();
    const n = state.seats.length;
    partyRows = state.seats.map((_, i) => {
      const name = h("input", {
        type: "text",
        value: state.names[i],
        "aria-label": `${i + 1} 番目の党の名前`,
        maxlength: 12,
        oninput: () => {
          state.names[i] = name.value.trim() || NAMES[i];
          schedule();
        },
      });
      const number = h("input", {
        type: "number",
        min: 1,
        max: MAX_SEATS,
        step: 1,
        value: state.seats[i],
        inputmode: "numeric",
        "aria-label": `${state.names[i]} の議席`,
        oninput: () => {
          const v = Number(number.value);
          if (Number.isFinite(v) && v >= 1) setSeats(i, v);
        },
        onchange: () => {
          number.value = state.seats[i];
        },
      });
      const minus = h("button", { type: "button", "aria-label": `${state.names[i]} の議席を 1 減らす`, onclick: () => setSeats(i, state.seats[i] - 1) }, "−");
      const plus = h("button", { type: "button", "aria-label": `${state.names[i]} の議席を 1 増やす`, onclick: () => setSeats(i, state.seats[i] + 1) }, "+");
      const remove = h("button", {
        type: "button",
        "aria-label": `${state.names[i]} を削除`,
        title: "削除",
        disabled: n <= MIN_PARTIES,
        onclick: () => removeParty(i),
      }, "×");
      const row = h("div", { class: "vt-party" },
        h("span", { class: "vt-swatch", style: { background: partyColor(i) }, "aria-hidden": "true" }),
        name, minus, number, plus, remove,
      );
      partyList.append(row);
      return { name, number, minus, plus, remove };
    });
    addButton.disabled = n >= MAX_PARTIES;
    view = null; // 党の数が変わったら図も組み直す
  }

  function syncParties() {
    state.seats.forEach((v, i) => {
      const row = partyRows[i];
      if (!row) return;
      if (document.activeElement !== row.number) row.number.value = v;
      const label = state.names[i];
      row.number.setAttribute("aria-label", `${label} の議席`);
      row.minus.setAttribute("aria-label", `${label} の議席を 1 減らす`);
      row.plus.setAttribute("aria-label", `${label} の議席を 1 増やす`);
      row.remove.setAttribute("aria-label", `${label} を削除`);
      row.minus.disabled = v <= 1;
      row.plus.disabled = v >= MAX_SEATS;
    });
  }

  // ---- 計算と描画 ----
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      update();
    });
  }

  function update() {
    const t = total();
    if (state.followMajority) state.quota = majority(t);
    state.quota = Math.max(1, Math.min(t, state.quota));
    quotaSlider.input.max = t;
    quotaSlider.set(state.quota);

    const t0 = performance.now();
    result = call(wasm.voting, new Uint32Array(state.seats), state.quota);
    elapsed = performance.now() - t0;

    const measured = Math.round(stage.clientWidth - 16);
    if (measured > 0) width = Math.max(320, Math.min(900, measured));
    if (!view || view.width !== width || view.n !== state.seats.length) build();

    for (const [k, b] of presetButtons.entries()) b.setAttribute("aria-pressed", String(PRESETS[k].id === state.preset));
    presetNote.textContent = PRESETS.find((p) => p.id === state.preset)?.note ?? "";
    quotaInfo.textContent = `全 ${t} 票のうち ${state.quota} 票 (${fmt((100 * state.quota) / t, 1)}%) で可決。`;

    syncParties();
    drawHemicycle();
    drawChart();
    drawTable();
    drawCoalitions();
    const n = state.seats.length;
    timing.textContent = `計算時間 ${fmt(elapsed, 1)} ms (${n} 党、提携 ${(2 ** n).toLocaleString("ja-JP")} 個)`;
  }

  function values() {
    const t = total();
    const share = state.seats.map((v) => v / t);
    if (result.error) return { share };
    return {
      share,
      shapley_shubik: result.shapley_shubik,
      banzhaf: result.banzhaf,
      nucleolus: Array.isArray(result.nucleolus) ? result.nucleolus : null,
    };
  }

  // ---- 半円の議席図 ----
  function build() {
    const n = state.seats.length;
    const W = width;
    const R = Math.min((W - 32) / 2, 230);
    const cx = W / 2;
    const cy = R + 28;
    hemiSvg.setAttribute("viewBox", `0 0 ${W} ${cy + R * 0.085 + 6}`);
    hemiSvg.replaceChildren();
    const dots = s("g");
    const quotaLine = s("line", { stroke: "var(--ink)", "stroke-width": 2, "stroke-dasharray": "5 4" });
    const quotaLabel = s("text", { "font-size": 12, fill: "var(--ink)", "font-weight": 500 });
    const centerSmall = s("text", { x: cx, y: cy - 34, "text-anchor": "middle", "font-size": 12, fill: "var(--muted)" }, "可決に必要");
    const centerBig = s("text", { x: cx, y: cy - 8, "text-anchor": "middle", "font-size": R < 120 ? 18 : 24, "font-weight": 700, fill: "var(--ink)" });
    hemiSvg.append(dots, quotaLine, quotaLabel, centerSmall, centerBig);

    // 棒グラフ
    const narrow = W < 520;
    const labelW = narrow ? 92 : 124;
    const valueW = 46;
    const x0 = labelW;
    const scaleW = W - x0 - valueW - 8;
    const barH = 11;
    const gap = 2;
    const groupH = METRICS.length * barH + (METRICS.length - 1) * gap;
    const G = groupH + 20;
    const top = 26;
    chartSvg.setAttribute("viewBox", `0 0 ${W} ${top + n * G}`);
    chartSvg.replaceChildren();
    const grid = s("g");
    chartSvg.append(grid);
    const groups = [];
    for (let i = 0; i < n; i++) {
      const y = top + i * G;
      const g = s("g", { transform: `translate(0 ${y})` });
      const swatch = s("circle", { cx: 6, cy: 7, r: 5, fill: partyColor(i) });
      const name = s("text", { x: 16, y: 11, "font-size": 13, "font-weight": 500, fill: "var(--ink)" });
      const sub = s("text", { x: 16, y: 27, "font-size": 11, fill: "var(--muted)" });
      g.append(swatch, name, sub);
      const bars = METRICS.map((m, k) => {
        const by = k * (barH + gap);
        const rect = s("rect", { class: "vt-bar", x: x0, y: by, height: barH, width: 0, fill: m.color, rx: 1.5 });
        const label = s("text", { class: "vt-move", x: x0 + (k === 0 ? 7 : 4), y: by + barH - 1.5, "font-size": 11, fill: "var(--muted)" });
        g.append(rect, label);
        return { rect, label };
      });
      // 議席の棒の端: ドラッグかキーで議席を変える
      const handle = s("g", {
        class: "vt-handle vt-move",
        tabindex: 0,
        role: "slider",
        "aria-valuemin": 1,
        "aria-valuemax": MAX_SEATS,
      });
      handle.append(
        s("rect", { x: x0 - 9, y: -6, width: 18, height: barH + 12, fill: "transparent" }),
        s("rect", { x: x0 - 3, y: -3, width: 6, height: barH + 6, rx: 2, fill: "var(--ink)" }),
      );
      g.append(handle);
      attachHandle(handle, i);
      chartSvg.append(g);
      groups.push({ name, sub, bars, handle });
    }
    view = { width: W, n, R, cx, cy, dots, quotaLine, quotaLabel, centerBig, x0, scaleW, grid, top, G, groups, axisMax: 1 };
  }

  function attachHandle(handle, i) {
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handle.focus();
      handle.setPointerCapture(event.pointerId);
      chartSvg.classList.add("dragging");
      axisLock = view.axisMax;
      const move = (e) => {
        const p = svgPoint(chartSvg, e);
        const target = Math.max(0.002, Math.min(0.98, (p.x - view.x0) / view.scaleW * view.axisMax));
        const others = total() - state.seats[i];
        setSeats(i, (target * others) / (1 - target));
      };
      const up = () => {
        chartSvg.classList.remove("dragging");
        axisLock = null;
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        schedule();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
    handle.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 10 : 1;
      const keys = {
        ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step,
        PageUp: 10, PageDown: -10,
      };
      if (e.key in keys) setSeats(i, state.seats[i] + keys[e.key]);
      else if (e.key === "Home") setSeats(i, 1);
      else if (e.key === "End") setSeats(i, MAX_SEATS);
      else return;
      e.preventDefault();
    });
  }

  function seatLayout(N) {
    // 内側半径 0.42 から外周 1 までを rows 列に分け、各列に半径に比例した数の席を置く。
    const inner = 0.42;
    let rows = 1;
    let radii;
    let capacity;
    for (;;) {
      const d = (1 - inner) / rows;
      radii = Array.from({ length: rows }, (_, k) => inner + d * (k + 0.5));
      capacity = radii.map((r) => Math.floor((Math.PI * r) / d) + 1);
      if (capacity.reduce((a, b) => a + b, 0) >= N) break;
      rows++;
    }
    const d = (1 - inner) / rows;
    const sumR = radii.reduce((a, b) => a + b, 0);
    const counts = radii.map((r, k) => Math.min(capacity[k], Math.floor((N * r) / sumR)));
    let rest = N - counts.reduce((a, b) => a + b, 0);
    for (let k = rows - 1; rest > 0; k = (k - 1 + rows) % rows) {
      if (counts[k] < capacity[k]) {
        counts[k]++;
        rest--;
      }
    }
    const seats = [];
    radii.forEach((r, k) => {
      const c = counts[k];
      for (let j = 0; j < c; j++) {
        const theta = c === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (c - 1);
        seats.push({ r, theta });
      }
    });
    seats.sort((a, b) => b.theta - a.theta || a.r - b.r);
    const spacing = Math.min(d, ...counts.map((c, k) => (c > 1 ? (Math.PI * radii[k]) / (c - 1) : Infinity)));
    return { seats, dotR: Math.min(spacing * 0.42, 0.085) };
  }

  function drawHemicycle() {
    const { R, cx, cy, dots, quotaLine, quotaLabel, centerBig } = view;
    const N = total();
    const { seats, dotR } = seatLayout(N);
    const owner = [];
    state.seats.forEach((v, i) => {
      for (let k = 0; k < v; k++) owner.push(i);
    });
    const at = (r, theta) => [cx + R * r * Math.cos(theta), cy - R * r * Math.sin(theta)];
    dots.replaceChildren(
      ...seats.map((seat, k) => {
        const [x, y] = at(seat.r, seat.theta);
        return s("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: (R * dotR).toFixed(2), fill: partyColor(owner[k]) });
      }),
    );
    // 左から数えて quota 席目と次の席の間に可決ラインを引く。
    const q = state.quota;
    const theta = q >= N ? -0.03 : (seats[q - 1].theta + seats[q].theta) / 2;
    const [x1, y1] = at(0.44, theta);
    const [x2, y2] = at(1.07, theta);
    quotaLine.setAttribute("x1", x1);
    quotaLine.setAttribute("y1", y1);
    quotaLine.setAttribute("x2", x2);
    quotaLine.setAttribute("y2", y2);
    const [lx, ly] = at(1.1, theta);
    const anchor = Math.cos(theta) > 0.3 ? "start" : Math.cos(theta) < -0.3 ? "end" : "middle";
    quotaLabel.setAttribute("x", Math.max(4, Math.min(view.width - 4, lx)));
    quotaLabel.setAttribute("y", Math.max(12, ly - 2));
    quotaLabel.setAttribute("text-anchor", anchor);
    quotaLabel.textContent = "可決ライン";
    centerBig.textContent = `${q} / ${N}`;
    const parts = state.seats.map((v, i) => `${state.names[i]} ${v}`).join("、");
    hemiSvg.setAttribute("aria-label", `議席の半円図。${parts}。全 ${N} 票のうち ${q} 票で可決。`);
  }

  // ---- 棒グラフ ----
  function niceMax(x) {
    for (const m of [0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1]) if (x <= m + 1e-9) return m;
    return 1;
  }

  function drawChart() {
    const vals = values();
    const all = METRICS.flatMap((m) => vals[m.key] ?? []);
    const axisMax = axisLock ?? niceMax(Math.max(...all) * 1.04);
    view.axisMax = axisMax;
    const { x0, scaleW, grid, top, G, groups } = view;
    const n = state.seats.length;
    const step = axisMax <= 0.3 ? 0.05 : axisMax <= 0.6 ? 0.1 : 0.2;
    const bottom = top + n * G - 14;
    grid.replaceChildren();
    for (let v = 0; v <= axisMax + 1e-9; v += step) {
      const x = x0 + (v / axisMax) * scaleW;
      grid.append(
        s("line", { x1: x, x2: x, y1: top - 6, y2: bottom, stroke: v === 0 ? "var(--line)" : "var(--grid)", "stroke-width": 1 }),
        s("text", { x, y: top - 10, "text-anchor": "middle", "font-size": 10.5, fill: "var(--muted)" }, fmt(v, 2)),
      );
    }
    const xOf = (v) => (Math.max(0, v) / axisMax) * scaleW;
    groups.forEach((g, i) => {
      g.name.textContent = clip(state.names[i], x0 < 100 ? 6 : 8);
      const dummy = !result.error && result.swings[i] === 0;
      g.sub.textContent = dummy ? "投票力ゼロ (ダミー)" : `${state.seats[i]} 議席`;
      g.sub.setAttribute("fill", dummy ? "var(--bad)" : "var(--muted)");
      g.sub.setAttribute("font-weight", dummy ? 700 : 400);
      METRICS.forEach((m, k) => {
        const v = vals[m.key]?.[i];
        const { rect, label } = g.bars[k];
        const w = v == null ? 0 : xOf(v);
        rect.style.width = `${w}px`;
        rect.setAttribute("width", w);
        label.style.transform = `translateX(${w}px)`;
        label.textContent = v == null ? "–" : fmt(v, 3);
      });
      const wShare = xOf(vals.share[i]);
      g.handle.style.transform = `translateX(${wShare}px)`;
      g.handle.setAttribute("aria-label", `${state.names[i]} の議席`);
      g.handle.setAttribute("aria-valuenow", state.seats[i]);
      g.handle.setAttribute("aria-valuetext", `${state.seats[i]} 議席`);
    });
  }

  function clip(text, len) {
    return [...text].length > len ? `${[...text].slice(0, len - 1).join("")}…` : text;
  }

  // ---- 表と最小勝利提携 ----
  function vetoPlayers() {
    if (result.error || result.minimal_winning.length === 0) return [];
    return state.seats.map((_, i) => i).filter((i) => result.minimal_winning.every((m) => (m >> i) & 1));
  }

  function drawTable() {
    errorNote.hidden = !result.error;
    errorNote.textContent = result.error ? `計算できません: ${result.error}` : "";
    const vals = values();
    const veto = new Set(vetoPlayers());
    const nucError = !result.error && !Array.isArray(result.nucleolus) ? result.nucleolus?.error : null;
    tableBody.replaceChildren(
      ...state.seats.map((v, i) => {
        const dummy = !result.error && result.swings[i] === 0;
        return h("tr", {},
          h("td", {},
            h("span", { class: "key", style: { "--key": partyColor(i) } }, state.names[i]),
            dummy ? h("span", { class: "badge ng" }, "投票力ゼロ") : null,
            veto.has(i) ? h("span", { class: "badge ok" }, "拒否権") : null,
          ),
          h("td", {}, String(v)),
          h("td", {}, fmt(vals.share[i], 4)),
          h("td", {}, fmt(vals.shapley_shubik?.[i], 4)),
          h("td", {}, fmt(vals.banzhaf?.[i], 4)),
          h("td", {}, fmt(vals.nucleolus?.[i], 4)),
          h("td", {}, result.error ? "–" : String(result.swings[i])),
        );
      }),
    );
    const notes = [];
    if (nucError) notes.push(`仁は計算できなかった: ${nucError}`);
    if (veto.size > 0 && veto.size < state.seats.length) {
      notes.push(
        "拒否権を持つ党 (すべての勝利提携に含まれる党) がいる時、コア (英: core) は拒否権を持つ党だけに配分する。仁はコアに含まれるので、ほかの党の仁は 0 になる。",
      );
    }
    vetoNote.textContent = notes.join(" ");
    vetoNote.hidden = notes.length === 0;
  }

  function drawCoalitions() {
    if (result.error) {
      mwcList.replaceChildren();
      mwcNote.textContent = "";
      return;
    }
    const list = result.minimal_winning;
    const LIMIT = 12;
    mwcHead.textContent = `最小勝利提携 (${list.length} 個)`;
    mwcNote.textContent = "可決できて、どの党が抜けても否決になる党の組。";
    const names = (mask) => state.names.filter((_, i) => (mask >> i) & 1).join("・");
    mwcList.replaceChildren(
      ...list.slice(0, LIMIT).map((m) => h("li", {}, names(m))),
      ...(list.length > LIMIT ? [h("li", { style: { listStyle: "none", color: "var(--muted)" } }, `ほか ${list.length - LIMIT} 個`)] : []),
    );
  }

  // 幅が変わったら viewBox を作り直し、文字が画面上で小さくなりすぎないようにする。
  new ResizeObserver(() => {
    const measured = Math.round(stage.clientWidth - 16);
    if (measured > 0 && Math.max(320, Math.min(900, measured)) !== width && state.seats.length) schedule();
  }).observe(stage);

  // 初期状態: 5 党、過半数
  state.names = NAMES.slice(0, 5);
  state.seats = [38, 30, 17, 10, 5];
  state.followMajority = true;
  rebuildParties();
  update();
}
