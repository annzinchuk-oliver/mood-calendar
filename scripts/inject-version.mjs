// scripts/inject-version.mjs
import { readFileSync, writeFileSync } from "fs";

const file = "index.html";
let html = readFileSync(file, "utf8");

// версия = короткий SHA коммита + timestamp
const sha = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
const version = `${sha || "dev"} • ${stamp}`;
const buildId = Date.now().toString();

// 1) %APP_VERSION%
html = html.replace(/%APP_VERSION%/g, version);

// 2) __BUILD_ID__ → числовой buildId
html = html.replace(/__BUILD_ID__/g, buildId);

// 3) На всякий случай: если плейсхолдера нет, обновим query у css
html = html
  .replace(/(tokens\.css)(\?v=\d+)?/g, `$1?v=${buildId}`)
  .replace(/(components\.css)(\?v=\d+)?/g, `$1?v=${buildId}`);

writeFileSync(file, html);
console.log("Injected version:", version, "buildId:", buildId);
