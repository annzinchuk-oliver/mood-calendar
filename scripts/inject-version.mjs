// scripts/inject-version.mjs
import { readFileSync, writeFileSync } from "fs";

const file = "index.html";
let html = readFileSync(file, "utf8");

// версия из SHA коммита + метка времени
const sha = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
const version = `${sha || "dev"} • ${stamp}`;

// подставим в %APP_VERSION% и обновим кэш-метки для css
html = html.replace(/%APP_VERSION%/g, version)
           .replace(/(tokens\.css)(\?v=\d+)?/g, `$1?v=${Date.now()}`)
           .replace(/(components\.css)(\?v=\d+)?/g, `$1?v=${Date.now()}`);

writeFileSync(file, html);
console.log("Injected version:", version);
