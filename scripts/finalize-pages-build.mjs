import { existsSync, renameSync } from "node:fs";

const input = "dist/pages.html";
const output = "dist/index.html";
if (!existsSync(input)) {
  throw new Error(`Pages build entry was not emitted: ${input}`);
}
renameSync(input, output);
