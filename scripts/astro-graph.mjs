/**
 * dependency-cruiser nie parsuje plikow .astro, wiec cala warstwa widoku byla poza
 * grafem. Ten skrypt czyta importy z frontmatteru plikow .astro i dokleja brakujace
 * krawedzie do wyniku dependency-cruiser, dajac pelny obraz zamiast czesciowego.
 *
 * Metoda jest prostsza niz analiza skladniowa: wyrazenie regularne po instrukcjach
 * import. Wystarcza, bo w .astro importy stoja w frontmatterze i nie sa dynamiczne —
 * ale kazda krawedz stad jest oznaczona jako pochodzaca z prostszego odczytu.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const ROOT = "src";
const IMPORT = /^\s*import\s+(?:[\s\S]*?from\s+)?["']([^"']+)["']/gm;

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function resolveSpecifier(spec, fromFile) {
  if (spec.startsWith("@/")) return `src/${spec.slice(2)}`;
  if (spec.startsWith(".")) return relative(process.cwd(), resolve(dirname(fromFile), spec));
  return null; // pakiet zewnetrzny albo modul wirtualny (astro:*)
}

const edges = [];
for (const file of walk(ROOT).filter((f) => f.endsWith(".astro"))) {
  const source = readFileSync(file, "utf8");
  const frontmatter = source.startsWith("---") ? source.slice(3, source.indexOf("\n---", 3)) : "";
  for (const match of frontmatter.matchAll(IMPORT)) {
    const target = resolveSpecifier(match[1], file);
    if (target) edges.push({ from: file, to: target, spec: match[1] });
  }
}

const layerOf = (path) => {
  if (path.startsWith("src/lib/domain")) return "domena";
  if (path.startsWith("src/lib/services")) return "dane";
  if (path.startsWith("src/pages/api")) return "punkty koncowe";
  if (path.startsWith("src/pages")) return "strony";
  if (path.startsWith("src/components")) return "widok";
  if (path.startsWith("src/layouts")) return "widok";
  if (path.startsWith("src/lib")) return "wspolne";
  return "inne";
};

const violations = edges.filter((e) => layerOf(e.from) !== "domena" && e.to.startsWith("src/lib/domain") && layerOf(e.from) === "widok");

writeFileSync("/tmp/astro-edges.json", JSON.stringify({ edges, violations }, null, 2));

console.log(`plikow .astro: ${new Set(edges.map((e) => e.from)).size}`);
console.log(`krawedzi wewnetrznych: ${edges.length}\n`);

const counts = {};
for (const e of edges) {
  const key = `${layerOf(e.from)} -> ${layerOf(e.to)}`;
  counts[key] = (counts[key] ?? 0) + 1;
}
console.log("przeplyw miedzy warstwami:");
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(2)}x  ${k}`);

console.log("\nstrony siegajace wprost do reguly domenowej (pomijajac warstwe danych):");
const direct = edges.filter((e) => e.to.startsWith("src/lib/domain") && layerOf(e.from) !== "dane");
console.log(direct.length ? direct.map((e) => `  ${e.from} -> ${e.to}`).join("\n") : "  brak");
