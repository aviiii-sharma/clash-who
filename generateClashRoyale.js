const fs = require("fs");
const path = require("path");

const IMAGES_DIR = path.join(
  __dirname,
  "client/public/images/clash-royale"
);

const OUTPUT_FILE = path.join(
  __dirname,
  "server/topics/clashRoyale.js"
);

// helper: convert "MegaKnight.png" → "Mega Knight"
function prettifyName(filename) {
  return filename
    .replace(".png", "")
    .replace(/([A-Z])/g, " $1")
    .trim();
}

// helper: convert "MegaKnight.png" → "mega-knight"
function makeId(filename) {
  return filename
    .replace(".png", "")
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");
}

const files = fs
  .readdirSync(IMAGES_DIR)
  .filter((f) => f.endsWith(".png"));

const cards = files.map((file) => ({
  id: makeId(file),
  name: prettifyName(file),
  elixir: null,        // fill later if needed
  type: "troop",       // default (can refine later)
  rarity: "unknown",   // default
  evo: false,
  image: `/images/clash-royale/${file}`,
}));

const output =
  "module.exports = " +
  JSON.stringify(cards, null, 2) +
  ";\n";

fs.writeFileSync(OUTPUT_FILE, output);

console.log(
  `✅ Generated clashRoyale.js with ${cards.length} cards`
);
