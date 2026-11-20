#!/usr/bin/env node
// 由 content.js + manifest.json 生成油猴脚本，输出到 dist/zhihu-ide.user.js
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const core = readFileSync(join(root, "content.js"), "utf8");

const meta = `// ==UserScript==
// @name         知乎 · 暗色 IDE 皮肤
// @namespace    https://github.com/dfdbb/zhihu-dark-ide
// @version      ${manifest.version}
// @description  把知乎重绘为暗色 IDE：活动栏 + 文件树 + 标签页 + minimap + 状态栏，正文按代码编辑器排版。完全本地运行，不联网、不采集数据。
// @author       dfdbb
// @match        https://www.zhihu.com/*
// @match        https://zhihu.com/*
// @match        https://zhuanlan.zhihu.com/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

`;

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "zhihu-ide.user.js"), meta + core);
console.log(`dist/zhihu-ide.user.js 已生成（v${manifest.version}）`);
