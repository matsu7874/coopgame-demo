// 水道管の費用: 最小全域木ゲーム (Bird 1976)。家と供給元をドラッグし、管の総費用の分け方を 3 つの規則で比べる。
import { h, s, fmt, call, COLORS, draggable, frame } from "../ui.js";

const W = 1000;
const H = 640;
const MARGIN = 40;
const SCALE = 10; // 座標 10 単位 = 1 万円
const MIN_HOUSES = 2;
const MAX_HOUSES = 8;
const NAMES = "ABCDEFGH";

const RULES = [
  { key: "bird", label: "Bird 規則", color: "var(--alt1)" },
  { key: "shapley", label: "Shapley 値", color: COLORS.shapley },
  { key: "nucleolus", label: "仁", color: COLORS.nucleolus },
];

// 座標は viewBox 単位。index 0 が供給元、1.. が家。
const PRESETS = [
  {
    label: "一列に並んだ家 (遠くの家ほど得する?)",
    points: [[100, 320], [300, 320], [500, 320], [700, 320], [900, 320]],
  },
  {
    label: "Shapley 値がコアから外れる配置",
    points: [[100, 200], [900, 450], [550, 100], [400, 550]],
  },
  {
    label: "離れた 2 つの集落",
    points: [[120, 320], [320, 190], [320, 450], [780, 190], [890, 320], [780, 450]],
  },
];

const ICON_DROP = "M0,-30 C10,-14 22,-2 22,10 A22,22 0 0 1 -22,10 C-22,-2 -10,-14 0,-30 Z";

export function mount(root, wasm) {
  const { stage, panel } = frame(root, {
    title: "水道管の費用",
    lead:
      "家を水源 (水滴の印) につなぐ水道管を引く。管は隣の家を経由してもよいので、全員で引けば最小全域木 (英: minimum spanning tree) の長さだけ費用がかかり、各家が単独で引くより安い。" +
      "この総費用を家どうしでどう分けるかを、Bird 規則・Shapley 値・仁で比べる。点はドラッグで動かせる。費用は距離に比例し、単位は万円。",
  });

  let points = PRESETS[2].points.map((p) => [...p]);
  let rule = "bird";
  let result = null;

  // ---- 図 ----
  const svg = s("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": "水源と家の地図。太線が最小全域木の水道管、点線が単独で引いた場合の管。",
  });
  const gridLayer = s("g", { "aria-hidden": "true" });
  for (let x = 100; x < W; x += 100) gridLayer.append(s("line", { x1: x, y1: 0, x2: x, y2: H, stroke: "var(--grid)", "stroke-width": 1 }));
  for (let y = 100; y < H; y += 100) gridLayer.append(s("line", { x1: 0, y1: y, x2: W, y2: y, stroke: "var(--grid)", "stroke-width": 1 }));
  const gridLabel = gridLayer.appendChild(
    s("text", { x: W - 12, y: H - 12, "text-anchor": "end", "font-size": 18, fill: "var(--muted)" }, "格子 1 マス = 10 万円"),
  );
  const standaloneLayer = s("g", { "aria-hidden": "true" });
  const pipeLayer = s("g", { "aria-hidden": "true" });
  const pipeLabelLayer = s("g", { "aria-hidden": "true" });
  const nodeLayer = s("g");
  const shareLayer = s("g", { "aria-hidden": "true" });
  svg.append(gridLayer, standaloneLayer, pipeLayer, pipeLabelLayer, shareLayer, nodeLayer);
  stage.append(svg);

  // ---- パネル ----
  const ruleButtons = RULES.map((r) =>
    h(
      "button",
      { type: "button", "aria-pressed": String(r.key === rule), onclick: () => setRule(r.key) },
      h("span", { class: "key", style: `--key: ${r.color}` }, r.label),
    ),
  );
  const ruleExplain = h("div", { class: "note", style: { marginTop: "8px" }, "aria-live": "polite" });
  const tableBody = h("tbody");
  const tableFoot = h("tfoot");
  const table = h(
    "table",
    { class: "result" },
    h(
      "thead",
      {},
      h(
        "tr",
        {},
        h("th", { scope: "col" }, "家"),
        h("th", { scope: "col" }, "単独で引く費用"),
        RULES.map((r) => h("th", { scope: "col", style: { color: r.color } }, r.key === "bird" ? "Bird" : r.key === "shapley" ? "Shapley" : "仁")),
      ),
    ),
    tableBody,
    tableFoot,
  );
  const badges = h("div", { class: "buttons", style: { gap: "6px 10px" } });
  const coreNote = h("p", { class: "note" });
  const addButton = h("button", { type: "button", onclick: addHouse }, "家を足す");
  const removeButton = h("button", { type: "button", onclick: removeHouse }, "家を減らす");
  const status = h("p", { class: "note", "aria-live": "polite" });

  panel.append(
    h("div", {}, h("h3", {}, "表示する分け方"), h("div", { class: "buttons", role: "group", "aria-label": "表示する分け方" }, ruleButtons), ruleExplain),
    h("div", {}, h("h3", {}, "各家の負担 (万円)"), h("div", { style: { overflowX: "auto" } }, table)),
    h("div", {}, h("h3", {}, "コア (英: core) に入るか"), badges, h("p", { class: "note", style: { marginTop: "6px" } },
      "コアに入る分け方では、どの家の組も「自分たちだけで水源まで管を引いた方が安い」とはならない。コアから外れると、その組は全体の計画から抜ける理由を持つ。"), coreNote),
    h(
      "div",
      {},
      h("h3", {}, "配置"),
      h("div", { class: "buttons" }, addButton, removeButton, h("button", { type: "button", onclick: randomize }, "ランダムに配置")),
      h("div", { class: "buttons", style: { marginTop: "6px" } },
        PRESETS.map((p) => h("button", { type: "button", onclick: () => setPoints(p.points) }, p.label))),
      h("p", { class: "note", style: { marginTop: "6px" } },
        "家と水源はドラッグで動かせる。Tab で選んで矢印キーでも動く (Shift で大きく動く)。"),
      status,
    ),
  );

  // ---- 計算と描画 ----
  function compute() {
    const xs = new Float64Array(points.map((p) => p[0] / SCALE));
    const ys = new Float64Array(points.map((p) => p[1] / SCALE));
    result = call(wasm.spanningTree, xs, ys);
  }

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
    compute();
    drawMap();
    drawPanel();
  }

  // 図が狭く表示される時 (スマートフォン) は、文字と点を k 倍に大きくして読める大きさを保つ。
  let k = 1;
  const resize = new ResizeObserver(() => {
    const width = svg.getBoundingClientRect().width;
    if (!width) return;
    const next = Math.round(Math.min(2.2, Math.max(1, 640 / width)) * 10) / 10;
    if (next === k) return;
    k = next;
    gridLabel.setAttribute("font-size", 18 * k);
    placeNodes();
    if (result) drawMap();
  });
  resize.observe(svg);

  const dist = (a, b) => Math.hypot(points[a][0] - points[b][0], points[a][1] - points[b][1]) / SCALE;

  function drawMap() {
    standaloneLayer.replaceChildren();
    pipeLayer.replaceChildren();
    pipeLabelLayer.replaceChildren();
    shareLayer.replaceChildren();
    const [sx, sy] = points[0];
    for (let i = 1; i < points.length; i++) {
      standaloneLayer.append(
        s("line", { x1: sx, y1: sy, x2: points[i][0], y2: points[i][1], stroke: "var(--line)", "stroke-width": 2, "stroke-dasharray": "6 8" }),
      );
    }
    if (result?.error) return;
    for (const [u, v] of result.edges) {
      const [x1, y1] = points[u];
      const [x2, y2] = points[v];
      pipeLayer.append(s("line", { x1, y1, x2, y2, stroke: "var(--alt2)", "stroke-width": 12 * Math.min(k, 1.5), "stroke-linecap": "round" }));
      // 管の長さ (費用) を中点の少し脇に書く。
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      let nx = -(y2 - y1) / len;
      let ny = (x2 - x1) / len;
      if (ny > 0) [nx, ny] = [-nx, -ny];
      // Bird 規則では、管の家側の端の家がその管を払う。狭い画面 (k が大きい) では重なるので費用だけ書き、
      // 誰が払うかはパネルの一覧で示す。
      const label = rule === "bird" && k <= 1.3 ? `${NAMES[v - 1]} が払う ${fmt(dist(u, v), 1)}` : fmt(dist(u, v), 1);
      const tx = mx + nx * 22 * k;
      const ty = my + ny * 22 * k + 6 * k;
      pipeLabelLayer.append(
        s("text", { x: tx, y: ty, "text-anchor": "middle", "font-size": 18 * k, fill: "var(--alt2)", "font-weight": 500,
          stroke: "var(--surface)", "stroke-width": 5 * k, "paint-order": "stroke" }, label),
      );
    }
    drawShares();
  }

  // 家の脇に 3 つの規則の負担を細い棒で並べ、選んだ規則の値を数字で書く。
  // 置き場所は家の下・上・右・左から、管・他の点・他のラベルに重ならない所を選ぶ。
  function drawShares() {
    // ラベルは基準の大きさで組み、置き場所の判定だけ k 倍の大きさで行う。
    const BAR_W = 100;
    const BAR_H = 7;
    const BOX_H = 3 * (BAR_H + 3) + 26;
    const boxW = BAR_W * k;
    const boxH = BOX_H * k;
    const gap = 32 * k;
    const maxCost = Math.max(...result.standalone, 1);
    const samples = [];
    for (const [u, v] of result.edges) {
      const [x1, y1] = points[u];
      const [x2, y2] = points[v];
      const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 8);
      for (let j = 0; j <= steps; j++) samples.push([x1 + ((x2 - x1) * j) / steps, y1 + ((y2 - y1) * j) / steps, 1]);
    }
    points.forEach(([x, y]) => samples.push([x, y, 20]));
    // 右下の縮尺の注記も避ける。
    for (let x = W - 12 - 190 * k; x < W; x += 10) samples.push([x, H - 12 - 8 * k, 5]);
    const placed = [];
    const selected = RULES.find((r) => r.key === rule);
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i];
      const candidates = [
        [x - boxW / 2, y + gap],
        [x - boxW / 2, y - gap - boxH],
        [x + gap, y - boxH / 2],
        [x - gap - boxW, y - boxH / 2],
      ];
      let best = null;
      candidates.forEach(([left, top], order) => {
        const pad = 6;
        const inside = (px, py, extra) =>
          px > left - pad - extra && px < left + boxW + pad + extra && py > top - pad - extra && py < top + boxH + pad + extra;
        let penalty = order * 0.5;
        if (left < 4 || left + boxW > W - 4 || top < 4 || top + boxH > H - 4) penalty += 1000;
        for (const [px, py, weight] of samples) if (inside(px, py, weight > 1 ? 18 * k : 0)) penalty += weight;
        for (const [l, t] of placed) if (l < left + boxW + 8 && left < l + boxW + 8 && t < top + boxH + 8 && top < t + boxH + 8) penalty += 200;
        if (!best || penalty < best.penalty) best = { left, top, penalty };
      });
      const { left, top } = best;
      placed.push([left, top]);
      const g = s("g", { transform: `translate(${left} ${top}) scale(${k})` });
      RULES.forEach((r, row) => {
        const cost = result[r.key]?.costs?.[i - 1];
        if (cost == null) return;
        const width = Math.max(0, (cost / maxCost) * BAR_W);
        const by = row * (BAR_H + 3);
        g.append(s("rect", { x: 0, y: by, width: BAR_W, height: BAR_H, fill: "var(--grid)" }));
        g.append(s("rect", { x: 0, y: by, width, height: BAR_H, fill: r.color, opacity: r.key === rule ? 1 : 0.4 }));
      });
      const value = result[rule]?.costs?.[i - 1];
      g.append(
        s("text", { x: BAR_W / 2, y: BOX_H - 4, "text-anchor": "middle", "font-size": 21, "font-weight": 700, fill: selected.color,
          stroke: "var(--surface)", "stroke-width": 5, "paint-order": "stroke" },
          value == null ? "–" : fmt(value, 1)),
      );
      shareLayer.append(g);
    }
  }

  // 点 (水源と家) は数が変わった時だけ作り直し、ドラッグ中は位置だけ動かす。
  let nodes = [];
  function buildNodes() {
    nodeLayer.replaceChildren();
    nodes = points.map((_, i) => {
      const isSource = i === 0;
      const name = isSource ? "水源" : `家 ${NAMES[i - 1]}`;
      const g = s("g", { tabindex: 0, role: "button", "aria-label": `${name}。矢印キーで移動` });
      if (isSource) {
        g.append(
          s("circle", { r: 34, fill: "transparent" }),
          s("path", { d: ICON_DROP, fill: "var(--surface)", stroke: "var(--alt2)", "stroke-width": 4, "stroke-linejoin": "round" }),
          s("text", { y: 54, "text-anchor": "middle", "font-size": 18, fill: "var(--muted)",
            stroke: "var(--surface)", "stroke-width": 5, "paint-order": "stroke" }, "水源"),
        );
      } else {
        g.append(
          s("circle", { r: 24, fill: "var(--surface)", stroke: "var(--ink)", "stroke-width": 3 }),
          s("text", { y: 8, "text-anchor": "middle", "font-size": 22, "font-weight": 700, fill: "var(--ink)" }, NAMES[i - 1]),
        );
      }
      draggable(svg, g, (x, y) => movePoint(i, x, y));
      g.addEventListener("keydown", (event) => {
        const step = event.shiftKey ? 50 : 10;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
        if (!d) return;
        event.preventDefault();
        movePoint(i, points[i][0] + d[0], points[i][1] + d[1]);
      });
      nodeLayer.append(g);
      return g;
    });
    placeNodes();
  }

  function placeNodes() {
    nodes.forEach((g, i) => g.setAttribute("transform", `translate(${points[i][0]} ${points[i][1]}) scale(${k})`));
  }

  const clampX = (x) => Math.min(Math.max(x, MARGIN * k), W - MARGIN * k);
  const clampY = (y) => Math.min(Math.max(y, MARGIN * k), H - MARGIN * k);

  function movePoint(i, x, y) {
    points[i] = [clampX(x), clampY(y)];
    placeNodes();
    schedule();
  }

  function setPoints(next) {
    points = next.map((p) => [...p]);
    buildNodes();
    update();
  }

  // 他の点から離れた位置を探す。
  function freeSpot(existing) {
    let best = null;
    let bestGap = -1;
    for (let tries = 0; tries < 200; tries++) {
      const p = [MARGIN + 40 + Math.random() * (W - 2 * MARGIN - 80), MARGIN + 40 + Math.random() * (H - 2 * MARGIN - 80)];
      const gap = Math.min(...existing.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])), Infinity);
      if (gap > 160) return p.map(Math.round);
      if (gap > bestGap) [best, bestGap] = [p, gap];
    }
    return best.map(Math.round);
  }

  function addHouse() {
    if (points.length - 1 >= MAX_HOUSES) return;
    setPoints([...points, freeSpot(points)]);
  }

  function removeHouse() {
    if (points.length - 1 <= MIN_HOUSES) return;
    setPoints(points.slice(0, -1));
  }

  function randomize() {
    const next = [];
    for (let i = 0; i < points.length; i++) next.push(freeSpot(next));
    setPoints(next);
  }

  function setRule(key) {
    rule = key;
    ruleButtons.forEach((b, k) => b.setAttribute("aria-pressed", String(RULES[k].key === key)));
    drawMap();
    drawPanel();
  }

  // 供給元と家の組 mask (ビット i = 家 i) だけで引いた時の最小全域木の長さ。
  function coalitionCost(mask) {
    const verts = [0];
    for (let i = 0; i < points.length - 1; i++) if (mask >> i & 1) verts.push(i + 1);
    const best = new Map(verts.slice(1).map((v) => [v, dist(0, v)]));
    let total = 0;
    while (best.size) {
      let v = -1;
      let d = Infinity;
      for (const [u, du] of best) if (du < d) [v, d] = [u, du];
      best.delete(v);
      total += d;
      for (const [u, du] of best) best.set(u, Math.min(du, dist(v, u)));
    }
    return total;
  }

  // 負担の合計が単独で引く費用を最も上回る組 (コアの条件を最も破る組)。
  function worstCoalition(costs) {
    const n = costs.length;
    let worst = null;
    for (let mask = 1; mask < (1 << n) - 1; mask++) {
      let pay = 0;
      for (let i = 0; i < n; i++) if (mask >> i & 1) pay += costs[i];
      const own = coalitionCost(mask);
      if (!worst || pay - own > worst.pay - worst.own) worst = { mask, pay, own };
    }
    return worst;
  }

  // 選んだ分け方の定義。Bird 規則は、各家がどの管を払うかを今の配置で列挙する。
  function explainRule() {
    const place = (i) => (i === 0 ? "水源" : `家 ${NAMES[i - 1]}`);
    if (rule === "bird") {
      const items = (result?.edges ?? []).map(([u, v]) =>
        h("li", {}, `家 ${NAMES[v - 1]}: ${place(u)} から引く管 (${fmt(dist(u, v), 1)} 万円)`));
      ruleExplain.replaceChildren(
        h("p", { style: { margin: "0 0 4px" } },
          "Bird 規則 (Bird 1976): 全員をつなぐ最小全域木を水源から 1 本ずつ伸ばしていき、各家は自分を木につないだ管 1 本 (水源側から自分の家に来る管) の費用を払う。図の管 (幅の広い画面) にも払う家を書いている。この分け方は、どの配置でもコアに入る。"),
        h("ul", { style: { margin: 0, paddingLeft: "1.2em" } }, items),
      );
    } else if (rule === "shapley") {
      ruleExplain.textContent =
        "Shapley 値: 家が 1 軒ずつ加わる順番を全て同じ確率で考え、その家が加わった時に増える管の費用 (最小全域木の長さの増分) を平均した額を払う。配置によってはコアから外れる。";
    } else {
      ruleExplain.textContent =
        "仁: どの家の組についても「その組だけで水源まで引いた場合の費用 − その組の負担の合計」(組にとっての得) を考え、最も得の小さい組の得をできるだけ大きくし、同点なら次に得の小さい組の得を大きくする分け方。コアが空でなければコアに入る。";
    }
  }

  function drawPanel() {
    explainRule();
    addButton.disabled = points.length - 1 >= MAX_HOUSES;
    removeButton.disabled = points.length - 1 <= MIN_HOUSES;
    status.textContent = `家 ${points.length - 1} 軒`;
    tableBody.replaceChildren();
    tableFoot.replaceChildren();
    badges.replaceChildren();
    if (result?.error) {
      coreNote.textContent = `計算できません: ${result.error}`;
      return;
    }
    const cell = (r, i) => {
      const value = result[r.key]?.costs?.[i];
      return h("td", { style: r.key === rule ? { fontWeight: 700, color: r.color } : {} }, value == null ? "–" : fmt(value, 1));
    };
    for (let i = 0; i < points.length - 1; i++) {
      tableBody.append(h("tr", {}, h("th", { scope: "row" }, NAMES[i]), h("td", {}, fmt(result.standalone[i], 1)), RULES.map((r) => cell(r, i))));
    }
    const standaloneSum = result.standalone.reduce((a, b) => a + b, 0);
    tableFoot.append(
      h("tr", {}, h("th", { scope: "row" }, "合計"), h("td", {}, fmt(standaloneSum, 1)),
        RULES.map((r) => h("td", { style: { fontWeight: 700 } }, result[r.key]?.costs ? fmt(result.total, 1) : "–"))),
    );

    const messages = [];
    for (const r of RULES) {
      const res = result[r.key];
      if (!res || res.error) {
        badges.append(h("span", { class: "badge ng" }, `${r.label}: 計算できない`));
        if (res?.error) messages.push(`${r.label}: ${res.error}`);
        continue;
      }
      badges.append(h("span", { class: `badge ${res.in_core ? "ok" : "ng"}` }, `${r.label}: ${res.in_core ? "コアに入る" : "コアから外れる"}`));
      if (!res.in_core) {
        const w = worstCoalition(res.costs);
        const members = NAMES.slice(0, points.length - 1).split("").filter((_, i) => w.mask >> i & 1);
        messages.push(
          `${r.label}では、家 ${members.join("・")} の負担の合計は ${fmt(w.pay, 1)} 万円だが、この ${members.length} 軒だけで水源まで管を引けば ${fmt(w.own, 1)} 万円で済む。`,
        );
      }
    }
    coreNote.textContent = messages.join(" ");
    coreNote.hidden = messages.length === 0;
  }

  buildNodes();
  update();
}
