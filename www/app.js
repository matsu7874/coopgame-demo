// WASM を読み込み、URL の # に応じてシーンを切り替える。シーンは最初に開いた時に 1 回だけ組み立てる。
import init, * as wasm from "./pkg/coopgame_demo.js";

const SCENES = {
  triangle: () => import("./scenes/triangle.js"),
  talmud: () => import("./scenes/talmud.js"),
  voting: () => import("./scenes/voting.js"),
  water: () => import("./scenes/water.js"),
  guide: () => import("./scenes/guide.js"),
};
const DEFAULT = "triangle";

const stage = document.getElementById("stage");
const mounted = new Map();

async function show(name) {
  if (!(name in SCENES)) name = DEFAULT;
  for (const link of document.querySelectorAll(".tabs a")) {
    link.toggleAttribute("aria-current", link.dataset.scene === name);
    if (link.dataset.scene === name) link.setAttribute("aria-current", "page");
  }
  for (const [key, root] of mounted) root.hidden = key !== name;
  if (mounted.has(name)) return;
  const root = document.createElement("section");
  root.className = "scene";
  root.dataset.scene = name;
  mounted.set(name, root);
  stage.append(root);
  try {
    const module = await SCENES[name]();
    module.mount(root, wasm);
  } catch (error) {
    root.innerHTML = "";
    const p = document.createElement("p");
    p.className = "error";
    p.textContent = `シーンを表示できません: ${error}`;
    root.append(p);
    console.error(error);
  }
}

await init();
stage.querySelector(".loading")?.remove();
window.addEventListener("hashchange", () => show(location.hash.slice(1)));
show(location.hash.slice(1));
