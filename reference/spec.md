# ArchFlow 描述格式（arch.json）

一份 JSON 描述一张架构图和它的分页演示：模块怎么排、线怎么连、有哪些端到端流程、每一页亮什么。画布固定 1920×1080，不写坐标。完整示例：`examples/deepseek-harness.json`。

## 顶层

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | 是 | 标题，也是 HTML 标题和静态全景图的标题 |
| `eyebrow` | | 左上角小字，比如 `PI AGENT-CORE · 3551ec0` |
| `brand` | | 右下角落款 |
| `legend` | | 底部图例里出现哪些线：`call` `fact` `proj` `dep` `cfg` `evt`；也可写 `["call","自定义说明"]` |
| `sources` | | 出处，写进页面清单（outline.md），不上屏。`仓库@提交号（日期）`、`文件:行` |
| `layout` | 是 | 模块排版，见下 |
| `edges` | | 连线 |
| `flows` | | **命名流程**：一串连线按顺序走，配步骤条和编号徽标；多页可复用 |
| `insets` | | 浮层（机制演示、表格、卡片） |
| `scenes` | 是 | 页面，一页讲一个点 |
| `autoplay` | | 按 A 或 `?auto=1` 自动翻页的间隔毫秒，默认 8000 |
| `overviewTitle` / `overviewCaption` | | 静态全景图（`?overview=1`）的标题和底部说明，默认用 `title` |

## 排版：layout.rows

从上到下若干行，每行几个模块，每个模块几个节点。

```json
"layout": { "gapY": 20, "rows": [
  { "h": 1, "modules": [
    { "id": "drv", "label": "驱动核心", "span": 0.9, "dir": "col", "nodes": [
      { "id": "loop", "label": "默认驱动", "sub": "推着 Agent 一步步干活" }
    ]}
  ]}
]}
```

- 布局：`gapY` / `gapX` 行列间距，`top` 图的上边（默认 230）。有任意一页写了 `caption` 时，图的下边自动从 1010 上移到 952，给说明留一条带。
- 行：`h` 相对高度（默认 1）。
- 模块：`id`、`label`、`span` 相对宽度、`dir`（`row` 横排 / `col` 竖排）、`gap` 节点间距、`nodeH` 节点最大高度、`style:"outer"`（虚线外框、标题压在边框上，省高度）、`frame:false`（不画框）。
- 节点：`id`、`label`（2–8 字）、`sub`（一句话说它管什么）、`w` 相对宽度、`size` 字号。`{"spacer":true,"w":1}` 是空白占位。
- 建议 4–6 个模块、总共 ≤20 个节点、每个模块 ≤6 个节点。节点矮于 58px 时副标题被省略，检查会报。

## 连线：edges

```json
{ "id": "e_res", "from": "texec", "to": "log", "type": "fact", "label": "工具结果" }
```

- `from` / `to`：节点或模块。
- `type`：`call` 蓝实线（调用）、`fact` 橙实线（写入事实）、`proj` 绿点线（投影/读取）、`dep` 灰虚线（依赖）、`cfg` 灰实线（配置）、`evt` 紫虚线（事件）。
- 自动走线；需要时 `dir:"h"|"v"` 强制方向，`bend` 拱起，`fromOffset` / `toOffset` 微调端点，`d` 直接写 SVG 路径，`labelAt`（0–1）、`lx` / `ly` 挪标签。
- **线默认不显示**：每页用 `edges` 点名，或 `"all"` / `"auto"`（只显示亮着的模块之间的线）。`flow`、`trace` 用到的线自动显示。
- 连线 `label` 写关系（"调用模型"）；光点 `label` 写流的东西（"请求"）。

## 流程：flows

把"一次请求怎么走完全程"命名一次，在页面里用 `"trace": "<流程 id>"` 播放。

```json
"flows": [
  { "id": "turn", "title": "一次运转", "steps": [
    { "edge": "e_llm", "name": "请求模型", "label": "请求" },
    { "edge": "e_llm", "name": "拿到回复", "label": "回复", "rev": true },
    { "edge": "e_msg", "name": "回复入账", "label": "模型回复" },
    { "edge": "e_tool", "name": "执行工具", "jump": true },
    { "edge": "e_t1", "dur": 500 },
    { "edge": "e_res", "name": "结果入账", "label": "工具结果" }
  ]}
]
```

| 步骤字段 | 说明 |
|---|---|
| `edge` | 走哪条线（必填） |
| `name` | 步骤条上的名字（≤8 字）；不写时用 `label` |
| `label` | 光点上的字：流的是什么 |
| `rev` | 反向走（比如回复） |
| `dur` | 这一步走多久，默认 1000ms |
| `jump` | 声明这一步故意不接着上一步的终点出发（否则检查会报"流程断开"） |

- **既没有 `name` 也没有 `label` 的步骤是"过路步骤"**：光点照走，但不占步骤条的胶囊，也不画编号；步骤条沿用上一个胶囊。用它把中间的转手压掉，让步骤条只留关键节点。
- 播放时：右上出现步骤条（`1 请求模型 — 2 拿到回复 — …`），当前步骤高亮，走过的变灰；连线上画对应编号徽标；光点走到哪个节点哪个闪一下。
- 流程级 `badges:false` 关掉编号徽标；页面级 `"trace": {"flow":"turn","badges":false,"every":12000}` 可覆盖。`every` 是循环周期。
- 也可以在页面里内联：`"trace": [ {edge,…}, … ]`，有名字的步骤同样生成步骤条；页面写 `stepbar:false` 关步骤条。

## 浮层：insets

`place`：`full` `center` `bottom` `left` `right`，或 `box:[x,y,w,h]`。`title` 是浮层标题。

| type | 用途 | 字段 |
|---|---|---|
| `text` | 论点、边界说明 | `lines:[{text,color}]`；`hero:true` 时第一行当大标题 |
| `cards` | 分档、选型 | `items:[{head,text,color}]`、`footer` |
| `steps` | 一个机制的几步（两道锁、生命周期） | `steps:["一步",{label,lock:true}]`、`lines`。每步 ≤10 字，5–7 步 |
| `table` | 状态归属表、对照表 | `columns`、`rows`、`widths`；三列以上最后一列标黄 |
| `race` | 并发：一起跑、按什么顺序提交 | `tasks:[{label,len,exclusive}]`、`order:"model"|"finish"`、`footer` |

颜色：`blue` `amber` `mint` `coral` `violet` `ink` `ink2`。

## 页面：scenes

```json
{ "key": "工具系统", "title": "Function Call 落地：[工具系统三层]",
  "caption": "三层由同一处负责：**声明的工具 = 实际执行的工具**",
  "show": ["drv","tools","session"], "lit": ["texec"], "zoom": ["drv","tools"],
  "trace": "tool",
  "flow":  [{ "edge": "e_msg", "label": "模型回复" }],
  "notes": [{ "at": "tools", "pos": "above", "text": "一句要点" }],
  "states":[{ "node": "loop", "state": "failed", "at": 2000 }],
  "inset": "race" }
```

| 字段 | 说明 |
|---|---|
| `key` | 页短名，显示在左上角 |
| `title` | 大标题，`[ ]` 里的词做成高亮胶囊 |
| `caption` | **页说明**：底部常驻一句话（≤48 字），`**词**` 标黄。图要能脱离讲解者自己说清楚，结论写在这 |
| `show` / `half` | 亮哪些模块或节点 / 半亮作背景；不写就是全亮 |
| `lit` | 蓝色呼吸边框："正在讲它" |
| `zoom` | 镜头推近；有浮层时忽略 |
| `edges` | 显示哪些线：数组、`"all"`、`"auto"` |
| `trace` | 播放一个流程：流程 id、`{flow,badges,every}`，或内联步骤数组 |
| `flow` | 循环流动的光点：`{edge,label,count,dur,rev,delay}`，表示"持续在流" |
| `notes` | 注释：`{at,pos,text,color,size,width}`，`pos`：`below` `above` `right` `left` `inside`；或给 `x`、`y` |
| `states` | 节点状态动画：`{node,state,at,until}`，`state`：`off` `failed` `flash` `mount` |
| `inset` | 浮层 id（可数组） |
| `draw` | 模块逐个手绘画出，用在第一次看全景那页 |
| `edgeLabels` | 有 `trace` 的页默认藏连线标签；`true` 强制显示，`false` 其他页也藏 |

`full` / `center` 浮层且没写 `show` 时，背后的图自动变暗。

## 播放与导出

- `→` / 空格 / 点击：下一页；`←`：上一页；`R` 重播；`H` 隐藏图例；`L` 浅色；`A` 自动播放。
- `?s=5` 直达第 5 页；`?auto=1` 打开即自动播放；`?overview=1` **静态全景图**（全部模块、全部连线和标签，无动画浮层）；`?shot=1` 截图模式；`?check=1` 版面自检。
- `render.mjs --png` 额外导出 `<名字>.png`（静态全景）；`check.mjs` 在 shots 目录里同时输出 `overview.png` 和每页截图。
- 单文件 HTML，不联网，可双击、可部署。截图是第 5.5 秒的静帧（`--wait` 可调），流程循环的页可能拍在中间。
