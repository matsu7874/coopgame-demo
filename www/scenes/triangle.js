// 3 人ゲームの配分三角形。特性関数を動かすとコア・カーネル・仁・Shapley 値が動き、
// 利用者が三角形の中に置いた提案に対して、どの提携が不満を持つか (超過が正か) を示す。
//
// 特性関数はビット順 (提携 S のビット i がプレイヤー i)、空提携を除く 7 個の値。
// 三角形の頂点 i は「プレイヤー i が協力の余剰を全て受け取る配分」で、
// 配分 x の位置は重心座標 λ_i = (x_i - v({i})) / (v(N) - Σ v({j}))。

import { h, s, fmt, slider, call, COLORS, legend, draggable, frame } from "../ui.js";

const NAMES = ["A", "B", "C"];
const PAIRS = [3, 5, 6]; // {A,B}, {A,C}, {B,C}
const PROPER = [1, 2, 4, 3, 5, 6];

const PRESETS = [
  { label: "対称", values: [0, 0, 60, 0, 60, 60, 90], note: "誰と組んでも 2 人で 60、3 人で 90。コアは真ん中の 1 点だけ。" },
  { label: "コアが空", values: [0, 0, 80, 0, 80, 80, 90], note: "どの 2 人も 80 を得られるが、3 人では 90 しかない。どう分けても誰かが抜けたくなる。" },
  { label: "手袋の市場", values: [0, 0, 100, 0, 100, 0, 100], note: "A は左手袋、B と C は右手袋を 1 つずつ持つ。左右そろうと 100。コアは A が全部取る 1 点になる。" },
  { label: "非対称", values: [10, 0, 50, 0, 40, 30, 100], note: "コアが多角形になる例。仁はコアの「中心」に、Shapley 値は外れた所に来ることもある。" },
];

// 三角形の頂点 (viewBox 座標)。A が上、B が左下、C が右下。
const VERTICES = [
  [300, 46],
  [52, 476],
  [548, 476],
];

function size(mask) {
  return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
}
function members(mask) {
  return NAMES.filter((_, i) => (mask >> i) & 1);
}
function coalitionName(mask) {
  return `{${members(mask).join(", ")}}`;
}
function sumOver(mask, x) {
  return x.reduce((acc, xi, i) => acc + ((mask >> i) & 1 ? xi : 0), 0);
}

export function mount(root, wasm) {
  // values[mask - 1] = v(mask)
  const values = [...PRESETS[0].values];
  let proposal = null; // 利用者の提案 (配分)。null なら仁の位置に置く。
  let result = null;

  const v = (mask) => values[mask - 1];
  const singles = () => [v(1), v(2), v(4)];
  const surplus = () => v(7) - singles().reduce((a, b) => a + b, 0);

  // 配分 → 三角形の点
  function toPoint(x) {
    const r = surplus();
    const lambda = x.map((xi, i) => (xi - singles()[i]) / r);
    return [0, 1].map((axis) => lambda.reduce((acc, l, i) => acc + l * VERTICES[i][axis], 0));
  }
  // 三角形の点 → 配分 (三角形の外は辺に寄せる)
  function toAllocation(px, py) {
    const [[x0, y0], [x1, y1], [x2, y2]] = VERTICES;
    const det = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    let l0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / det;
    let l1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / det;
    let l2 = 1 - l0 - l1;
    [l0, l1, l2] = [l0, l1, l2].map((l) => Math.max(0, l));
    const total = l0 + l1 + l2;
    return [l0, l1, l2].map((l, i) => singles()[i] + (l / total) * surplus());
  }
  // λ_k = c の線分 (k の向かいの辺に平行)
  function levelLine(k, c) {
    const [i, j] = [0, 1, 2].filter((m) => m !== k);
    const at = (other) => [0, 1].map((a) => c * VERTICES[k][a] + (1 - c) * VERTICES[other][a]);
    return [at(i), at(j)];
  }

  // ---- 図 ----
  const svg = s("svg", { viewBox: "0 0 600 560", role: "img", "aria-label": "配分三角形" });
  const layer = s("g");
  const userDot = s("g", { tabindex: 0, role: "slider", "aria-label": "あなたの提案 (矢印キーで動かせる)" },
    s("circle", { r: 22, fill: "transparent" }),
    s("circle", { r: 9, fill: "var(--surface)", stroke: "var(--ink)", "stroke-width": 3 }),
    s("circle", { r: 3, fill: "var(--ink)" }),
  );
  const userLabel = s("text", { "font-size": 13, "font-weight": 700, fill: "var(--ink)", "paint-order": "stroke", stroke: "var(--surface)", "stroke-width": 4 }, "あなたの提案");
  svg.append(layer, userLabel, userDot);

  // ---- パネル ----
  const { stage, panel } = frame(root, {
    title: "3 人の分け前",
    lead: "3 人が組むと得られる額を v(S) で決める。三角形の各点は 3 人で全額を分ける分け方の 1 つだ。白い点を動かすと、その分け方に不満を持つ提携 (2 人だけで組んだ方が得をする組) が赤く光る。誰も抜けたくならない分け方の集合がコア、不満の最大値をできるだけ小さくする分け方が仁 (英: nucleolus) である。",
  });
  stage.append(svg);

  const presetNote = h("p", { class: "note" });
  const presetButtons = PRESETS.map((preset, index) =>
    h("button", { type: "button", onclick: () => applyPreset(index) }, preset.label),
  );

  const sliders = new Map();
  const addSlider = (mask, max) => {
    const control = slider({
      label: `v${coalitionName(mask)}`,
      min: 0,
      max,
      step: 1,
      value: v(mask),
      onInput: (value) => {
        values[mask - 1] = value;
        for (const b of presetButtons) b.setAttribute("aria-pressed", "false");
        presetNote.textContent = "";
        update();
      },
    });
    sliders.set(mask, control);
    return control.row;
  };

  const proposalTable = h("tbody");
  const complaintChart = s("svg", { viewBox: "0 0 320 150", role: "img", "aria-label": "提携ごとの不満" });
  const verdict = h("p", { class: "note" });
  const solutionTable = h("tbody");
  const facts = h("p", { class: "note" });

  panel.append(
    h("div", {}, h("h3", {}, "例"), h("div", { class: "buttons" }, presetButtons), presetNote),
    h("div", {}, h("h3", {}, "組むと得られる額 v(S)"),
      ...PAIRS.map((m) => addSlider(m, 120)),
      addSlider(7, 160),
      h("details", {}, h("summary", { class: "note" }, "1 人で得られる額"), ...[1, 2, 4].map((m) => addSlider(m, 60))),
    ),
    h("div", {},
      h("h3", {}, "あなたの提案"),
      h("table", { class: "result" }, h("thead", {}, h("tr", {}, h("th", {}, ""), NAMES.map((n) => h("th", {}, n)))), proposalTable),
      h("div", { class: "buttons", style: { marginTop: "8px" } },
        h("button", { type: "button", onclick: () => moveTo(result?.nucleolus) }, "仁に動かす"),
        h("button", { type: "button", onclick: () => moveTo(result?.shapley) }, "Shapley 値に動かす"),
      ),
    ),
    h("div", {}, h("h3", {}, "提携ごとの不満 v(S) − x(S)"), complaintChart, verdict),
    h("div", {}, h("h3", {}, "解"),
      h("table", { class: "result" }, h("thead", {}, h("tr", {}, h("th", {}, ""), NAMES.map((n) => h("th", {}, n)), h("th", {}, "コア"))), solutionTable),
      facts,
    ),
  );

  // ---- 操作 ----
  draggable(svg, userDot, (px, py) => {
    proposal = toAllocation(px, py);
    drawProposal();
  });
  userDot.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 10 : 2;
    const delta = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[event.key];
    if (!delta || !proposal) return;
    event.preventDefault();
    const [px, py] = toPoint(proposal);
    proposal = toAllocation(px + delta[0], py + delta[1]);
    drawProposal();
  });

  let animation = 0;
  function moveTo(target) {
    if (!Array.isArray(target) || !proposal) return;
    cancelAnimationFrame(animation);
    const from = [...proposal];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const tick = (now) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / 450);
      const ease = 1 - (1 - t) ** 3;
      proposal = from.map((a, i) => a + (target[i] - a) * ease);
      drawProposal();
      if (t < 1) animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
  }

  function applyPreset(index) {
    values.splice(0, 7, ...PRESETS[index].values);
    for (const [mask, control] of sliders) control.set(v(mask));
    presetButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(i === index)));
    presetNote.textContent = PRESETS[index].note;
    proposal = null;
    update();
  }

  // ---- 描画 ----
  function update() {
    if (surplus() <= 1e-9) {
      result = null;
      layer.replaceChildren(
        s("text", { x: 300, y: 270, "text-anchor": "middle", fill: "var(--muted)", "font-size": 16 },
          "v{A, B, C} が 1 人ずつの額の和以下なので、分ける余剰がない"),
      );
      userDot.style.display = userLabel.style.display = "none";
      return;
    }
    userDot.style.display = userLabel.style.display = "";
    result = call(wasm.triangle, new Float64Array(values));
    if (result.error) {
      layer.replaceChildren(s("text", { x: 300, y: 270, "text-anchor": "middle", fill: "var(--bad)" }, result.error));
      return;
    }
    if (!proposal || proposal.some(Number.isNaN)) {
      // 最初はコアから外れやすい位置に置き、動かすと不満が消える様子を見せる。
      proposal = toAllocation(250, 400);
    } else {
      // v(N) が変わったら提案を三角形の中に収め直す。
      proposal = toAllocation(...toPoint(rescale(proposal)));
    }
    drawGame();
    drawProposal();
    drawSolutions();
  }

  // 合計が v(N) になるように、余剰の比率を保って直す。
  function rescale(x) {
    const extra = x.map((xi, i) => Math.max(0, xi - singles()[i]));
    const total = extra.reduce((a, b) => a + b, 0) || 1;
    return extra.map((e, i) => singles()[i] + (e / total) * surplus());
  }

  function drawGame() {
    const nodes = [];
    const tri = VERTICES.map((p) => p.join(",")).join(" ");
    nodes.push(s("polygon", { points: tri, fill: "none", stroke: "var(--line)", "stroke-width": 1.5 }));

    // 目盛り: 余剰の 10% ごとの格子
    for (let k = 0; k < 3; k++) {
      for (let c = 0.1; c < 0.95; c += 0.1) {
        const [a, b] = levelLine(k, c);
        nodes.push(s("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: "var(--grid)", "stroke-width": 1 }));
      }
    }

    // コア
    const core = result.core_vertices ?? [];
    if (core.length >= 3) {
      const points = core.map(toPoint);
      const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
      const cy = points.reduce((a, p) => a + p[1], 0) / points.length;
      points.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
      nodes.push(s("polygon", { points: points.map((p) => p.join(",")).join(" "), fill: "var(--core-fill)", stroke: COLORS.core, "stroke-width": 2 }));
    } else if (core.length === 2) {
      const [a, b] = core.map(toPoint);
      nodes.push(s("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: COLORS.core, "stroke-width": 6, "stroke-linecap": "round", opacity: 0.6 }));
    } else if (core.length === 1) {
      const [x, y] = toPoint(core[0]);
      nodes.push(s("circle", { cx: x, cy: y, r: 14, fill: "var(--core-fill)", stroke: COLORS.core, "stroke-width": 2 }));
    }

    // 2 人の提携の境界線 x_i + x_j = v(ij)。線より外側 (向かいの頂点側) では {i, j} に不満がある。
    for (const mask of PAIRS) {
      const k = [0, 1, 2].find((m) => !((mask >> m) & 1));
      const c = (v(7) - v(mask) - singles()[k]) / surplus();
      if (c <= 0.001 || c >= 0.999) continue;
      const [a, b] = levelLine(k, c);
      // 不満が出る側 (頂点 k を含む小さな三角形) は、不満がある時だけ薄く塗る。
      nodes.push(s("polygon", { points: [VERTICES[k], a, b].map((p) => p.join(",")).join(" "), fill: "var(--bad)", opacity: 0, "data-mask": mask, class: "unhappy-zone" }));
      nodes.push(s("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: "var(--muted)", "stroke-width": 1.5, "stroke-dasharray": "5 4", "data-mask": mask, class: "boundary" }));
      // ラベルは線の端 (三角形の辺の外側) に置き、中央で重ならないようにする。
      const end = mask === 6 ? a : b;
      const centroid = [300, 333];
      const len = Math.hypot(end[0] - centroid[0], end[1] - centroid[1]) || 1;
      const out = [(end[0] - centroid[0]) / len, (end[1] - centroid[1]) / len];
      nodes.push(s("text", { x: end[0] + out[0] * 12, y: end[1] + out[1] * 12 + 4, "text-anchor": out[0] < -0.2 ? "end" : out[0] > 0.2 ? "start" : "middle", "font-size": 12, fill: "var(--muted)", "data-mask": mask, class: "boundary-label" }, coalitionName(mask)));
    }

    // カーネル
    if (Array.isArray(result.kernel)) {
      for (const piece of result.kernel) {
        const points = piece.map(toPoint);
        if (points.length >= 2) {
          nodes.push(s("polyline", { points: points.map((p) => p.join(",")).join(" "), fill: "none", stroke: COLORS.kernel, "stroke-width": 4, "stroke-linecap": "round" }));
        } else if (points.length === 1) {
          nodes.push(s("circle", { cx: points[0][0], cy: points[0][1], r: 5, fill: COLORS.kernel }));
        }
      }
    }

    // Shapley 値 (ひし形) と仁 (丸)
    const markers = [];
    const shap = toPoint(result.shapley);
    markers.push({ point: shap, label: "Shapley 値", color: COLORS.shapley, shape: "diamond" });
    if (Array.isArray(result.nucleolus)) markers.push({ point: toPoint(result.nucleolus), label: "仁", color: COLORS.nucleolus, shape: "circle" });
    const sameSpot = markers.length === 2 && Math.hypot(markers[0].point[0] - markers[1].point[0], markers[0].point[1] - markers[1].point[1]) < 18;
    markers.forEach((m, index) => {
      const [x, y] = m.point;
      nodes.push(m.shape === "diamond"
        ? s("rect", { x: x - 7, y: y - 7, width: 14, height: 14, transform: `rotate(45 ${x} ${y})`, fill: m.color, stroke: "var(--surface)", "stroke-width": 2 })
        : s("circle", { cx: x, cy: y, r: 7.5, fill: m.color, stroke: "var(--surface)", "stroke-width": 2 }));
      const dy = sameSpot ? (index === 0 ? -14 : 22) : -14;
      nodes.push(s("text", { x: x + 12, y: y + dy, "font-size": 13, "font-weight": 700, fill: m.color, "paint-order": "stroke", stroke: "var(--surface)", "stroke-width": 4 }, m.label));
    });

    // 頂点のラベル
    const anchors = [[0, -14, "middle"], [-6, 48, "start"], [6, 48, "end"]];
    VERTICES.forEach(([x, y], i) => {
      const [dx, dy, anchor] = anchors[i];
      nodes.push(s("text", { x: x + dx, y: y + dy, "text-anchor": anchor, "font-size": 14, fill: "var(--ink)" },
        s("tspan", { "font-weight": 700 }, NAMES[i]), ` が余剰を全部取る`));
    });

    layer.replaceChildren(...nodes);
  }

  function drawProposal() {
    if (!proposal || !result || result.error) return;
    const [x, y] = toPoint(proposal);
    userDot.setAttribute("transform", `translate(${x} ${y})`);
    userDot.setAttribute("aria-valuetext", proposal.map((xi, i) => `${NAMES[i]} ${fmt(xi, 1)}`).join("、"));
    const below = y < 300;
    userLabel.setAttribute("x", x);
    userLabel.setAttribute("y", below ? y + 32 : y - 18);
    userLabel.setAttribute("text-anchor", "middle");

    const excess = PROPER.map((mask) => ({ mask, e: v(mask) - sumOver(mask, proposal) }));
    const unhappy = new Set(excess.filter(({ e }) => e > 1e-6).map(({ mask }) => mask));
    for (const node of layer.querySelectorAll(".boundary, .boundary-label, .unhappy-zone")) {
      const bad = unhappy.has(Number(node.dataset.mask));
      if (node.tagName === "polygon") node.setAttribute("opacity", bad ? 0.1 : 0);
      else node.setAttribute(node.tagName === "text" ? "fill" : "stroke", bad ? "var(--bad)" : "var(--muted)");
      if (node.tagName === "line") node.setAttribute("stroke-width", bad ? 3 : 1.5);
    }

    proposalTable.replaceChildren(
      h("tr", {}, h("td", {}, "取り分"), proposal.map((xi) => h("td", {}, fmt(xi, 1)))),
    );
    drawComplaints(excess);
  }

  function drawComplaints(excess) {
    const scale = Math.max(10, ...excess.map(({ e }) => Math.abs(e)));
    const zero = 200;
    const width = 100;
    const rows = excess.map(({ mask, e }, index) => {
      const y = 8 + index * 23;
      const len = (Math.abs(e) / scale) * width;
      const bad = e > 1e-6;
      return s("g", {},
        s("text", { x: 0, y: y + 12, "font-size": 12, fill: bad ? "var(--bad)" : "var(--ink)", "font-weight": bad ? 700 : 400 }, coalitionName(mask)),
        s("rect", { x: e >= 0 ? zero : zero - len, y, width: Math.max(len, 1), height: 15, fill: bad ? "var(--bad)" : "var(--line)", rx: 2 }),
        s("text", { x: e >= 0 ? zero + len + 4 : zero - len - 4, y: y + 12, "font-size": 12, "text-anchor": e >= 0 ? "start" : "end", fill: "var(--muted)" }, fmt(e, 1)),
      );
    });
    complaintChart.replaceChildren(
      s("line", { x1: zero, y1: 2, x2: zero, y2: 146, stroke: "var(--muted)" }),
      ...rows,
    );
    const worst = excess.reduce((a, b) => (b.e > a.e ? b : a));
    verdict.textContent = worst.e > 1e-6
      ? `${coalitionName(worst.mask)} は自分たちだけで組めば ${fmt(worst.e, 1)} 多く得る。この提案はコアに入らない。`
      : `どの提携も抜けて得をしない (最大の不満 ${fmt(worst.e, 1)})。この提案はコアに入る。`;
  }

  function drawSolutions() {
    const inCore = (x) => PROPER.every((mask) => sumOver(mask, x) >= v(mask) - 1e-6);
    const row = (label, color, x) => h("tr", {},
      h("td", {}, h("span", { class: "key", style: { "--key": color } }, label)),
      x.map((xi) => h("td", {}, fmt(xi, 2))),
      h("td", {}, inCore(x) ? h("span", { class: "badge ok" }, "入る") : h("span", { class: "badge ng" }, "外れる")),
    );
    const rows = [];
    if (Array.isArray(result.nucleolus)) rows.push(row("仁", COLORS.nucleolus, result.nucleolus));
    rows.push(row("Shapley 値", COLORS.shapley, result.shapley));
    solutionTable.replaceChildren(...rows);

    const parts = [];
    const core = result.core_vertices ?? [];
    if (core.length === 0) {
      const eps = result.least_core?.epsilon;
      parts.push(`コアは空。全員の不満を ${fmt(eps, 2)} 以下に抑えるのが限界 (最小コア)。`);
    } else {
      parts.push(`コアの頂点は ${core.length} 個。`);
    }
    parts.push(result.convex ? "このゲームは凸なので、Shapley 値は必ずコアに入る。" : "");
    facts.replaceChildren(
      legend([
        { label: "コア", color: COLORS.core },
        { label: "カーネル", color: COLORS.kernel },
        { label: "仁", color: COLORS.nucleolus },
        { label: "Shapley 値", color: COLORS.shapley },
      ]),
      h("span", {}, parts.join(" ")),
    );
  }

  applyPreset(0);
}
