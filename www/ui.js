// シーン共通の小さな部品。DOM と SVG の生成、数値の表示、スライダー、解の色。

const SVG_NS = "http://www.w3.org/2000/svg";

/** HTML 要素を作る。attrs の on* は addEventListener、それ以外は属性。 */
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  setAttrs(node, attrs);
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

/** SVG 要素を作る。 */
export function s(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  setAttrs(node, attrs);
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

function setAttrs(node, attrs) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (key === "style" && typeof value === "object") {
      // カスタムプロパティ (--key など) は setProperty でしか設定できない。
      for (const [name, v] of Object.entries(value)) {
        if (name.startsWith("--")) node.style.setProperty(name, v);
        else node.style[name] = v;
      }
    }
    else node.setAttribute(key, value === true ? "" : value);
  }
}

/** 数値を短く表示する (最大 digits 桁の小数、末尾の 0 は落とす)。 */
export function fmt(x, digits = 2) {
  if (x == null || Number.isNaN(x)) return "–";
  if (Math.abs(x) < 0.5 * 10 ** -digits) return "0";
  return Number(x.toFixed(digits)).toLocaleString("ja-JP", { maximumFractionDigits: digits });
}

/** ラベル・スライダー・値の 1 行。onInput(value) を呼ぶ。返り値の set(v) で値を外から変える。 */
export function slider({ label, min, max, step = 1, value, onInput, format = (v) => fmt(v) }) {
  const id = `r${Math.random().toString(36).slice(2, 9)}`;
  const input = h("input", { type: "range", id, min, max, step, value });
  const output = h("output", { for: id }, format(value));
  input.addEventListener("input", () => {
    output.textContent = format(Number(input.value));
    onInput(Number(input.value));
  });
  const row = h("div", { class: "control" }, h("label", { for: id }, label), input, output);
  return {
    row,
    input,
    set(v) {
      input.value = v;
      output.textContent = format(Number(v));
    },
  };
}

/** WASM の JSON 文字列を読む。 */
export function call(fn, ...args) {
  return JSON.parse(fn(...args));
}

/** 解の色 (CSS 変数名)。同じ解は全シーンで同じ色にする。 */
export const COLORS = {
  nucleolus: "var(--nuc)",
  shapley: "var(--shap)",
  core: "var(--core)",
  kernel: "var(--kernel)",
};

/** 色見本つきの凡例。items: [{ label, color }] */
export function legend(items) {
  return h("div", { class: "legend" }, items.map(({ label, color }) => h("span", { class: "key", style: { "--key": color } }, label)));
}

/** SVG 内のポインタ座標を viewBox 座標に直す。 */
export function svgPoint(svg, event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

/** 要素をドラッグできるようにする。onMove(x, y) は viewBox 座標。 */
export function draggable(svg, target, onMove, onEnd) {
  target.style.cursor = "grab";
  target.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    target.setPointerCapture(event.pointerId);
    target.style.cursor = "grabbing";
    const move = (e) => {
      const p = svgPoint(svg, e);
      onMove(p.x, p.y);
    };
    const up = () => {
      target.style.cursor = "grab";
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      onEnd?.();
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  });
}

/** シーンの見出し・図・操作パネルの骨組み。 */
export function frame(root, { title, lead }) {
  const stage = h("div", { class: "stage" });
  const panel = h("div", { class: "panel" });
  root.append(
    h("div", { class: "scene-head" }, h("h2", {}, title), h("p", {}, lead)),
    h("div", { class: "scene-body" }, stage, panel),
  );
  return { stage, panel };
}
