// Writes app/icon.svg from lib/brand/icon.ts. Run: npm run icon
import { writeFileSync } from "node:fs";
const { iconSvg } = await import("../lib/brand/icon.ts");
writeFileSync(new URL("../app/icon.svg", import.meta.url), iconSvg() + "\n");
console.log("wrote app/icon.svg");
