// ArchFlow —— 共用：读描述、静态检查、拼单文件 HTML。派生自 ArchTalk（MIT License, (c) 2026 xiaoni zhou / 心晴九天）。
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadSpec(path) {
  const raw = readFileSync(path, 'utf8');
  try { return JSON.parse(raw); }
  catch (e) { throw new Error(`${path} 不是合法 JSON：${e.message}`); }
}

export function lint(spec) {
  const errors = [], warnings = [];
  const E = m => errors.push(m), W = m => warnings.push(m);
  if (!spec || typeof spec !== 'object') { E('描述不是对象'); return { errors, warnings }; }
  if (!spec.title) E('缺少 title（这一期的标题）');
  const rows = spec.layout?.rows;
  if (!Array.isArray(rows) || !rows.length) E('缺少 layout.rows（模块怎么排）');
  if (!Array.isArray(spec.scenes) || !spec.scenes.length) E('缺少 scenes（页面）');

  const ids = new Map(); // id → 种类
  const add = (id, kind) => {
    if (!id) { E(`有一个${kind}没写 id`); return; }
    if (!/^[A-Za-z][\w-]*$/.test(id)) E(`${kind} id "${id}" 只能用字母、数字、下划线、连字符，且以字母开头`);
    if (ids.has(id)) E(`id "${id}" 重复（已经用作${ids.get(id)}）`);
    ids.set(id, kind);
  };
  const nodeIds = new Set(), modIds = new Set();
  (rows || []).forEach((r, ri) => {
    if (!Array.isArray(r.modules) || !r.modules.length) E(`layout.rows[${ri}] 没有 modules`);
    (r.modules || []).forEach(m => {
      add(m.id, '模块'); modIds.add(m.id);
      if (m.frame !== false && !m.label) W(`模块 ${m.id} 没有 label，画面上看不出它是什么`);
      (m.nodes || []).forEach(n => {
        if (n.spacer) return;
        add(n.id, '节点'); nodeIds.add(n.id);
        if (!n.label) E(`节点 ${n.id} 缺少 label`);
      });
      if ((m.nodes || []).filter(n => !n.spacer).length > 6) W(`模块 ${m.id} 有 ${(m.nodes || []).length} 个节点，太挤；拆成两个模块或去掉次要节点`);
    });
    if ((r.modules || []).length > 5) W(`第 ${ri + 1} 行放了 ${(r.modules || []).length} 个模块，横向太挤`);
  });
  const boxIds = new Set([...nodeIds, ...modIds]);
  const edgeIds = new Set();
  (spec.edges || []).forEach(e => {
    add(e.id, '连线'); edgeIds.add(e.id);
    if (!boxIds.has(e.from)) E(`连线 ${e.id} 的 from "${e.from}" 不存在`);
    if (!boxIds.has(e.to)) E(`连线 ${e.id} 的 to "${e.to}" 不存在`);
    if (e.type && !['call', 'fact', 'proj', 'dep', 'cfg', 'evt'].includes(e.type)) E(`连线 ${e.id} 的 type "${e.type}" 不认识（call/fact/proj/dep/cfg/evt）`);
  });
  const insetIds = new Set();
  (spec.insets || []).forEach(i => {
    add(i.id, '浮层'); insetIds.add(i.id);
    if (!['text', 'cards', 'steps', 'table', 'race'].includes(i.type)) E(`浮层 ${i.id} 的 type "${i.type}" 不认识（text/cards/steps/table/race）`);
    if (i.place && !['full', 'center', 'bottom', 'right', 'left'].includes(i.place)) E(`浮层 ${i.id} 的 place "${i.place}" 不认识`);
    if (i.type === 'steps') {
      const st = i.steps || [];
      if (st.length > 7) W(`浮层 ${i.id} 有 ${st.length} 步，屏幕放不下也记不住；拆成两页，或合并成 5–7 步`);
      st.forEach(x => { const l = typeof x === 'string' ? x : x?.label || ''; if (l.length > 12) W(`浮层 ${i.id} 的步骤"${l}"太长，像一句话；压到 10 个字以内，解释放进 lines 或 caption`); });
    }
  });

  const flowIds = new Set();
  const ends = id => { const e = (spec.edges || []).find(x => x.id === id); return e ? [e.from, e.to] : null; };
  const checkSteps = (steps, where) => {
    if (!Array.isArray(steps) || !steps.length) { E(`${where} 没有 steps`); return; }
    let prev = null;
    steps.forEach((t, i) => {
      if (!edgeIds.has(t?.edge)) { E(`${where} 第 ${i + 1} 步的 edge "${t?.edge}" 不存在`); prev = null; return; }
      const [a, b] = ends(t.edge); const [s0, s1] = t.rev ? [b, a] : [a, b];
      if (prev && prev !== s0 && !t.jump) W(`${where} 第 ${i}→${i + 1} 步断开：上一步停在 ${prev}，这一步从 ${s0} 出发。检查顺序或 rev；确实要跳，给这一步加 "jump":true`);
      prev = s1;
      const n = t.name || t.label || '';
      if (n.length > 8) W(`${where} 第 ${i + 1} 步的名字"${n}"太长，步骤条放不下；压到 8 个字以内`);
    });
    const named = steps.filter(t => t.name || t.label).length;
    if (named > 9) W(`${where} 有 ${named} 个带名字的步骤，步骤条太长；把过路步骤的 name/label 去掉，或拆成两段流程`);
  };
  (spec.flows || []).forEach(f => { add(f.id, '流程'); flowIds.add(f.id); checkSteps(f.steps, `流程 ${f.id}`); });

  const usedInsets = new Set(), usedFlows = new Set(), shownEdges = new Set(), focused = new Set();
  (spec.scenes || []).forEach((s, si) => {
    const at = `第 ${si + 1} 页${s.key ? `（${s.key}）` : ''}`;
    if (!s.title) E(`${at} 缺少 title`);
    else if ((s.title.match(/\[/g) || []).length !== (s.title.match(/\]/g) || []).length) E(`${at} 标题的 [ ] 没配对`);
    if (s.say) W(`${at} 有 say 字段：ArchFlow 不做口播，这段文字不会出现在任何地方；一句话说明改写进 caption`);
    if (s.caption && s.caption.replace(/\*\*/g, '').length > 48) W(`${at} 的 caption 有 ${s.caption.replace(/\*\*/g, '').length} 个字，超过一行；压到 48 字以内，细节放进注释或浮层`);
    const ref = (v, ok, what) => (Array.isArray(v) ? v : v == null || v === 'all' || v === 'auto' ? [] : [v]).forEach(id => { if (!ok.has(id)) E(`${at} 的 ${what} 引用了不存在的 "${id}"`); });
    ref(s.show, boxIds, 'show'); ref(s.half, boxIds, 'half'); ref(s.lit, boxIds, 'lit'); ref(s.zoom, boxIds, 'zoom');
    if (Array.isArray(s.edges)) ref(s.edges, edgeIds, 'edges');
    (s.flow || []).forEach(f => { ref(f.edge, edgeIds, 'flow'); shownEdges.add(f.edge); });
    let steps = [];
    const fid = typeof s.trace === 'string' ? s.trace : s.trace?.flow;
    if (fid) { if (!flowIds.has(fid)) E(`${at} 的 trace 引用了不存在的流程 "${fid}"`); else { usedFlows.add(fid); steps = spec.flows.find(f => f.id === fid).steps || []; } }
    else if (s.trace) { steps = Array.isArray(s.trace) ? s.trace : s.trace.steps || []; checkSteps(steps, `${at} 的 trace`); }
    steps.forEach(t => shownEdges.add(t?.edge));
    if (s.edges === 'all') edgeIds.forEach(e => shownEdges.add(e)); else if (Array.isArray(s.edges)) s.edges.forEach(e => shownEdges.add(e));
    (Array.isArray(s.show) ? s.show : []).concat(Array.isArray(s.lit) ? s.lit : []).forEach(id => focused.add(id));
    (s.notes || []).forEach(n => { if (n.at) ref(n.at, boxIds, 'notes.at'); else if (n.x == null || n.y == null) E(`${at} 有一条注释既没有 at 也没有 x/y`); });
    (s.states || []).forEach(st => {
      ref(st.node, boxIds, 'states');
      if (!['failed', 'off', 'flash', 'mount'].includes(st.state)) E(`${at} 的 states.state "${st.state}" 不认识（failed/off/flash/mount）`);
    });
    const ins = s.inset ? (Array.isArray(s.inset) ? s.inset : [s.inset]) : [];
    ins.forEach(i => { if (!insetIds.has(i)) E(`${at} 的 inset "${i}" 不存在`); usedInsets.add(i); });
    if (s.zoom && ins.length) W(`${at} 同时用了 zoom 和浮层：浮层会挡住推近的画面，zoom 已被忽略；二选一`);
    const moves = s.draw || s.caption || s.edges === 'all' || s.flow?.length || steps.length || s.lit?.length || ins.length || s.notes?.length || s.states?.length || s.zoom || Array.isArray(s.show);
    if (!moves) W(`${at} 画面上没有任何变化（没有点亮、光点、注释、浮层），和上一页看起来一样`);
  });
  insetIds.forEach(i => { if (!usedInsets.has(i)) W(`浮层 ${i} 定义了但没有页面用它`); });
  flowIds.forEach(f => { if (!usedFlows.has(f)) W(`流程 ${f} 定义了但没有页面用它（trace:"${f}"）`); });
  const scenes = spec.scenes || [];
  if (scenes.length > 16) W(`共 ${scenes.length} 页，太长；合并相近的页，或拆成两份描述`);
  if (scenes.length && !scenes.some(s => s.draw || (s.edges === 'all' && !Array.isArray(s.show)))) W('没有一页是全景（draw:true 或 edges:"all" 且不写 show）：观众拿不到地图');
  const lonely = [...edgeIds].filter(e => !shownEdges.has(e) && !scenes.some(s => s.edges === 'auto'));
  if (lonely.length) W(`这些连线从没在任何一页显示过：${lonely.join('、')}。要么在某页 edges 里点名，要么删掉`);
  const unseen = [...modIds].filter(m => !focused.has(m) && ![...focused].some(id => (rows || []).some(r => (r.modules || []).some(mm => mm.id === m && (mm.nodes || []).some(n => n.id === id)))));
  if (scenes.length > 3 && unseen.length) W(`这些模块从没被单独讲过（没出现在任何一页的 show / lit 里）：${unseen.join('、')}`);
  return { errors, warnings };
}

export function buildHtml(spec) {
  const css = readFileSync(join(ROOT, 'engine/engine.css'), 'utf8');
  const engine = readFileSync(join(ROOT, 'engine/engine.js'), 'utf8');
  const runtime = readFileSync(join(ROOT, 'engine/runtime.js'), 'utf8');
  const notices = [readFileSync(join(ROOT, 'LICENSE'), 'utf8'), readFileSync(join(ROOT, 'THIRD_PARTY_NOTICES.md'), 'utf8')].join('\n\n').replace(/-->/g, '--&gt;');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const json = JSON.stringify(spec).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="${esc(spec.lang || 'zh-CN')}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; connect-src 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="ArchFlow">
<title>${esc(spec.title)}</title>
<!-- ArchFlow 动态架构图。→ / 空格 下一页，← 上一页，R 重播，H 隐藏图例，L 浅色，A 自动播放；?s=3 直达第 3 页，?overview=1 静态全景图。 -->
<!--
${notices}
-->
<style>${css}</style>
</head>
<body>
<div id="stage">
  <svg id="world" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg"></svg>
  <svg id="hud" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg"></svg>
</div>
<script>${engine}</script>
<script>window.ARCHFLOW_SPEC=${json};</script>
<script>${runtime}</script>
</body>
</html>
`;
}

// 页面清单（Markdown）：给评审 / 写文档用，每页的标题、说明和亮了什么；不是口播稿
export function buildOutline(spec, htmlName) {
  const L = [`# ${spec.title}`, '', `配图：${htmlName}（→ 翻页；?overview=1 看静态全景）`, ''];
  const strip = t => String(t || '').replace(/[[\]]/g, '').replace(/\*\*/g, '');
  (spec.flows || []).forEach(f => {
    const names = (f.steps || []).map(t => t.name || t.label).filter(Boolean);
    L.push(`- 流程「${f.title || f.id}」：${names.join(' → ')}`);
  });
  if (spec.flows?.length) L.push('');
  spec.scenes.forEach((s, i) => {
    L.push(`## ${String(i + 1).padStart(2, '0')} · ${strip(s.title)}`);
    if (s.caption) L.push('', strip(s.caption));
    const bits = [];
    if (Array.isArray(s.show)) bits.push(`聚焦：${s.show.join('、')}`);
    const fid = typeof s.trace === 'string' ? s.trace : s.trace?.flow;
    if (fid) bits.push(`流程：${fid}`); else if (s.trace) bits.push('流程：本页内联');
    if (s.inset) bits.push(`浮层：${[].concat(s.inset).join('、')}`);
    if (bits.length) L.push('', `<sub>${bits.join(' ｜ ')}</sub>`);
    L.push('');
  });
  if (spec.sources?.length) { L.push('## 出处', ''); spec.sources.forEach(s => L.push(`- ${s}`)); L.push(''); }
  return L.join('\n');
}

export function findChrome() {
  const c = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  return c.find(p => existsSync(p)) || null;
}
