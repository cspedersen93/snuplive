// Kopierer MediaPipe-filerne til kamerafiltrene (sløret baggrund) fra node_modules til public/mediapipe,
// så de hentes fra vores egen server og ikke fra et fremmed CDN. Køres automatisk før build og dev.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const from = join("node_modules", "@mediapipe", "tasks-vision", "wasm");
const to = join("public", "mediapipe");
if (!existsSync(from)) {
  console.warn("[mediapipe] fandt ikke", from, "- sløret baggrund virker ikke i denne build");
  process.exit(0);
}
mkdirSync(to, { recursive: true });
for (const f of readdirSync(from)) copyFileSync(join(from, f), join(to, f));
console.log("[mediapipe] kopierede", readdirSync(from).length, "filer til", to);
