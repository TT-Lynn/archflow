#!/usr/bin/env node
// ArchFlow —— 把描述渲染成单文件 HTML（+ 页面清单，可选静态全景 PNG）。派生自 ArchTalk（MIT）。
// 用法：node scripts/render.mjs arch.json [--out 目录] [--png]
// 输出：<名字>.html（双击即开、可部署）、<名字>.outline.md（每页标题和说明，评审用）、--png 时 <名字>.png（静态全景图）。
import { writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { loadSpec, lint, buildHtml, buildOutline, findChrome } from './lib.mjs';

const args = process.argv.slice(2);
const specPath = args.find(a => !a.startsWith('--'));
if (!specPath) { console.log(JSON.stringify({ ok: false, error: '用法：node scripts/render.mjs arch.json [--out 目录] [--png]' })); process.exit(2); }
const outIdx = args.indexOf('--out');
const outDir = resolve(outIdx >= 0 ? args[outIdx + 1] : dirname(resolve(specPath)));

let spec;
try { spec = loadSpec(specPath); } catch (e) { console.log(JSON.stringify({ ok: false, error: e.message })); process.exit(1); }
const { errors, warnings } = lint(spec);
if (errors.length) { console.log(JSON.stringify({ ok: false, errors, warnings }, null, 1)); process.exit(1); }

const name = basename(specPath).replace(/\.json$/i, '');
mkdirSync(outDir, { recursive: true });
const html = join(outDir, `${name}.html`), outline = join(outDir, `${name}.outline.md`);
writeFileSync(html, buildHtml(spec));
writeFileSync(outline, buildOutline(spec, `${name}.html`));
const out = { ok: true, html, outline, scenes: spec.scenes.length, warnings };
if (args.includes('--png')) {
  const chrome = findChrome();
  if (!chrome) out.warnings.push('没找到 Chrome / Chromium / Edge，没导出全景 PNG；设置 CHROME_PATH 后重试');
  else {
    const png = join(outDir, `${name}.png`), prof = mkdtempSync(join(tmpdir(), 'archflow-chrome-'));
    try {
      execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${prof}`, '--window-size=1920,1080', '--virtual-time-budget=3000', `--screenshot=${png}`, `${pathToFileURL(html).href}?overview=1&shot=1`], { timeout: 90000, stdio: 'ignore' });
    } catch {}
    rmSync(prof, { recursive: true, force: true });
    if (existsSync(png)) out.png = png; else out.warnings.push('全景 PNG 导出失败');
  }
}
out.next = `node scripts/check.mjs ${specPath}`;
console.log(JSON.stringify(out, null, 1));
