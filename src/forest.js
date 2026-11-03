const SVG_NS = "http://www.w3.org/2000/svg";
let forestId = 0;

function node(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function add(parent, name, attributes) {
  const element = node(name, attributes);
  parent.append(element);
  return element;
}

function drawTree(parent, species, x, y, scale, growing = false) {
  const tree = add(parent, "g", {
    class: `forest-tree${growing ? " growing-tree" : ""}`,
    transform: `translate(${x} ${y}) scale(${scale})`,
  });
  add(tree, "ellipse", { cx: 0, cy: 1, rx: 30, ry: 5, fill: "#567553", opacity: ".13" });
  if (species === "birch") {
    add(tree, "path", { d: "M-3 0-2-102H3L4 0Z", fill: "#f4edce" });
    add(tree, "path", { d: "M2-8h-4m5-15h-4m3-22H0m2-18h-4", fill: "none", stroke: "#9b9575", "stroke-width": 2 });
    const crown = add(tree, "g", { class: "forest-canopy" });
    add(crown, "ellipse", { cx: -12, cy: -90, rx: 24, ry: 34, fill: "#9eaf75" });
    add(crown, "ellipse", { cx: 9, cy: -109, rx: 26, ry: 37, fill: "#b2be80" });
    add(crown, "ellipse", { cx: 17, cy: -82, rx: 20, ry: 29, fill: "#a2b678" });
    add(crown, "ellipse", { cx: -5, cy: -115, rx: 15, ry: 25, fill: "#c5cc92", opacity: ".55" });
    add(crown, "path", { d: "M0-57v-56m0 25-16-16m16 1 17-17", fill: "none", stroke: "#e7e6be", "stroke-width": 1.5, "stroke-linecap": "round" });
  } else if (species === "maple") {
    add(tree, "path", { d: "M-4 0-2-87H3L5 0Z", fill: "#97765a" });
    const crown = add(tree, "g", { class: "forest-canopy" });
    add(crown, "path", { d: "M0-149 14-130 28-134 32-113 48-107 43-89 53-73 33-61 18-56 0-49-22-57-40-62-49-78-39-95-42-111-25-116-24-133-11-129Z", fill: "#bf8864" });
    add(crown, "path", { d: "M0-149 14-130 28-134 32-113 12-101 4-79-17-88-25-116-24-133-11-129Z", fill: "#d4a47b" });
    add(crown, "path", { d: "M0-39v-79m0 48-24-26m24 10 24-23", fill: "none", stroke: "#a77859", "stroke-width": 2.5, "stroke-linecap": "round" });
    add(crown, "path", { d: "m-27-112 6 2m35-13 5 3m16 32 5 2m-26 20 4-1", stroke: "#e4b98b", "stroke-width": 2, "stroke-linecap": "round" });
  } else {
    add(tree, "path", { d: "M-4 0-2-111H3L5 0Z", fill: "#8c8060" });
    const crown = add(tree, "g", { class: "forest-canopy" });
    add(crown, "path", { d: "M0-160-27-113h13l-28 44h18l-30 43h108L24-69h18l-28-44h13Z", fill: "#4e7560" });
    add(crown, "path", { d: "M0-160-27-113h13l-28 44h18l-30 43H0Z", fill: "#668973" });
    add(crown, "path", { d: "M0-160 14-113H0Zm0 55 24 36H0Zm0 45 37 34H0Z", fill: "#436b57", opacity: ".6" });
    add(crown, "path", { d: "M0-122v93", stroke: "#335b48", "stroke-width": 1.5, opacity: ".45" });
  }
}

const positions = [
  [112, 339, .49], [425, 326, .47], [318, 343, .58],
  [505, 352, .62], [193, 355, .63], [367, 371, .68],
  [65, 378, .72], [559, 388, .71], [266, 386, .76],
  [458, 407, .85], [145, 416, .86], [330, 420, .92],
  [36, 440, .88], [593, 443, .89], [218, 444, .96],
  [391, 458, 1.04], [109, 467, 1.02], [493, 476, 1.06],
];

/**
 * History contains completed focus sessions with an optional `species` field.
 * Pass null progress when idle, or a fraction from 0 to 1 for a growing tree.
 * A maximum of 18 trees is drawn; the caller owns the accurate total counter.
 */
export function renderForest(container, history = [], progress = null, species = "pine") {
  if (!container) return;
  const sessions = Array.isArray(history) ? history : [];
  const active = typeof progress === "number" && Number.isFinite(progress);
  const fraction = active ? Math.min(1, Math.max(0, progress)) : 0;
  const id = `forest-${++forestId}`;
  const svg = node("svg", {
    viewBox: "0 0 640 510",
    preserveAspectRatio: "xMidYMax slice",
    role: "img",
    "aria-labelledby": `${id}-title ${id}-description`,
  });
  add(svg, "title", { id: `${id}-title` }).textContent = "Your forest at dawn";
  add(svg, "desc", { id: `${id}-description` }).textContent =
    `${sessions.length} completed-session ${sessions.length === 1 ? "tree" : "trees"}. ` +
    (active ? `A new ${["pine", "birch", "maple"].includes(species) ? species : "pine"} tree is growing, ${Math.round(fraction * 100)} percent through this session. ` : "") +
    (sessions.length > 18 ? "The most recent trees are shown. " : "") +
    "A warm sun rises over misty mountains and soft green hills.";

  const defs = add(svg, "defs");
  const sky = add(defs, "linearGradient", { id: `${id}-sky`, x2: "0", y2: "1" });
  add(sky, "stop", { offset: "0%", "stop-color": "#edf0e3" });
  add(sky, "stop", { offset: "63%", "stop-color": "#eee9d6" });
  add(sky, "stop", { offset: "100%", "stop-color": "#dce6cc" });
  const hill = add(defs, "linearGradient", { id: `${id}-hill`, x2: ".25", y2: "1" });
  add(hill, "stop", { offset: "0%", "stop-color": "#b6c79c" });
  add(hill, "stop", { offset: "100%", "stop-color": "#c8d6ab" });
  add(svg, "rect", { width: 640, height: 510, fill: `url(#${id}-sky)` });
  add(svg, "circle", { class: "sun-halo", cx: 397, cy: 183, r: 86, fill: "#f8edd3", opacity: ".7" });
  add(svg, "circle", { cx: 397, cy: 183, r: 60, fill: "#f4dfb6" });
  add(svg, "circle", { cx: 397, cy: 183, r: 45, fill: "#f6e5c4" });
  add(svg, "path", { d: "M0 265 79 218 146 253 237 183 311 247 379 208 469 249 547 199 640 242V510H0Z", fill: "#cbd2b9" });
  add(svg, "path", { d: "m146 253 91-70 74 64-66-34-42 29Z", fill: "#dce0ca" });
  add(svg, "path", { d: "M0 301 68 276 146 294 228 253 329 293 408 263 483 291 556 245 640 281V510H0Z", fill: "#bdcbaa" });
  add(svg, "path", { d: "M0 315c116-35 178-6 269-17 127-16 193-28 371 8v204H0Z", fill: "#d8dfc7" });
  add(svg, "path", { d: "M0 321c103-28 172-19 285 8s210 7 355-20v201H0Z", fill: "#c6d3b1" });
  const distant = add(svg, "g", { opacity: ".29", fill: "#6d8b67" });
  for (const [x, y, height] of [[15, 320, 38], [33, 323, 29], [48, 321, 44], [73, 323, 28], [538, 320, 37], [556, 317, 50], [575, 316, 33], [598, 317, 47], [624, 317, 30]]) {
    add(distant, "path", { d: `M${x} ${y - height}l${height / 3} ${height * .65}h-${height / 7}l${height / 4} ${height * .35}h-${height * .87}l${height / 4}-${height * .35}h-${height / 7}Z` });
  }
  add(svg, "path", { d: "M0 365c142-52 242-18 352-9s183-11 288-26v180H0Z", fill: `url(#${id}-hill)` });
  add(svg, "path", { d: "M640 343c-93 2-152 29-196 66-23 19-69 41-120 50-37 7-70 26-86 51h113c14-25 43-35 71-45 63-23 65-48 109-75 34-21 72-31 109-35Z", fill: "#e0debb", opacity: ".65" });
  add(svg, "path", { d: "M0 446c100-28 176-13 254 9s219 17 386-7v62H0Z", fill: "#b8cba0", opacity: ".65" });
  add(svg, "path", { d: "m244 161 6-3 6 3m15-12 5-2 5 2", fill: "none", stroke: "#98a58a", "stroke-width": 1.4, "stroke-linecap": "round" });
  const ground = add(svg, "g", { stroke: "#8fa578", "stroke-width": 1.2, "stroke-linecap": "round", opacity: ".6" });
  for (const [x, y] of [[55, 404], [163, 380], [296, 449], [541, 436], [605, 378], [75, 479], [364, 493], [480, 368], [204, 475]]) {
    add(ground, "path", { d: `M${x} ${y}v-7m0 7-4-4m4 4 4-5` });
  }
  const trees = add(svg, "g", { "aria-hidden": "true" });
  const visible = sessions.slice(-(active ? 17 : 18));
  visible.forEach((session, index) => {
    const [x, y, scale] = positions[index];
    drawTree(trees, session?.species || "pine", x, y, scale);
  });
  if (active) {
    drawTree(trees, species, 325, 460, .18 + fraction * .87, true);
    add(svg, "ellipse", { cx: 325, cy: 461, rx: 24, ry: 5, fill: "none", stroke: "#f7f5dc", "stroke-width": 1, "stroke-dasharray": "3 5", opacity: ".75" });
  } else if (sessions.length === 0) {
    const sprout = add(svg, "g", { transform: "translate(316 398)", "aria-hidden": "true" });
    add(sprout, "ellipse", { cx: 0, cy: 19, rx: 17, ry: 3, fill: "#728f60", opacity: ".16" });
    add(sprout, "path", { d: "M0 18V0", stroke: "#688956", "stroke-width": 2, "stroke-linecap": "round" });
    add(sprout, "path", { d: "M0 8C-13 8-14-4-14-4S1-5 0 8Z", fill: "#87a16c" });
    add(sprout, "path", { d: "M0 2C0-10 13-13 13-13S16 0 0 2Z", fill: "#73965e" });
    add(svg, "text", { x: 316, y: 450, "text-anchor": "middle", fill: "#768c63", "font-family": "Georgia, serif", "font-size": 11, "font-style": "italic" }).textContent = "Good things begin with a little time.";
  }
  container.replaceChildren(svg);
}
