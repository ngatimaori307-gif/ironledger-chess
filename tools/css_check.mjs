/* 1.13.0: every stylesheet's comments are closed and its braces balanced. An unclosed comment silently hides the rules after it
   (it hid the page layout while 1.13.0 was built). Run: node tools/css_check.mjs */
import { readFileSync, readdirSync } from "node:fs";
let bad = 0;
for (const f of readdirSync(new URL("../css/", import.meta.url))) {
  if (!f.endsWith(".css")) continue;
  const css = readFileSync(new URL("../css/" + f, import.meta.url), "utf8"), open = (css.match(/\/\*/g) || []).length;
  /* a comment left open runs on to the next comment's end: its text then holds another "/*" — and the rules between are gone */
  const swallowing = [...css.matchAll(/\/\*([\s\S]*?)\*\//g)].find((m) => m[1].includes("/*"));
  const closed = css.replace(/\/\*[\s\S]*?\*\//g, ""), unclosed = closed.includes("/*") || !!swallowing;
  let depth = 0, low = 0; for (const ch of closed) { if (ch === "{") depth++; if (ch === "}") depth--; low = Math.min(low, depth); }
  if (unclosed || depth || low < 0) { bad++; console.log(`${f}: ${unclosed ? "a comment never closed (line " + (css.slice(0, swallowing ? swallowing.index : css.lastIndexOf("/*")).split("\n").length) + ") " : ""}${depth || low < 0 ? "braces don't balance" : ""}`); }
  else console.log(`${f}: ${open} comments closed, braces balanced`);
}
process.exit(bad ? 1 : 0);
