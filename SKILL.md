---
name: archflow
description: Use when the user wants a codebase, agent harness, framework or system architecture drawn as an animated, step-through diagram, or wants a specific request / data / control flow shown moving across modules — e.g. "画架构图", "动态架构图", "把这个仓库的架构画出来", "演示一次请求怎么走", "流程动画", "架构全景图", "ArchFlow". Not for narrated video scripts (that is archtalk).
license: MIT
metadata:
  version: "0.1.0"
  derived-from: "archtalk 0.1.0 by xiaoni zhou / 心晴九天 (MIT)"
---

# ArchFlow · 动态架构图

一页讲一个点，图自己能说清楚。读懂源码后写一份 `arch.json`（模块、连线、**流程**、页面），脚本渲染成单文件 HTML + 静态全景 PNG，再逐页截图检查。**不要手写 HTML / SVG。**

`AF` = `<本 skill 文件夹>/scripts`。需要 Node 18+；截图检查需要本机 Chrome / Chromium / Edge（或设 `CHROME_PATH`）。

## 流程

1. **读源码，定模块。** 模块 = 真实代码单元（包、目录、类），不为好看自造分层。每条结论记出处（文件:行），写进 `sources`。
2. **定流程。** 先找 1 条主流程（一次请求 / 一轮循环从进到出），再找 1–3 条关键子流程（工具调用、持久化、错误恢复）。每条写成 `flows` 里的一串连线；只给关键步骤起 `name`，中间转手留作过路步骤。
3. **排页面**（见下表）。
4. **写 `arch.json`**：格式见 `reference/spec.md`，照 `examples/deepseek-harness.json` 改最快。
5. **检查：** `node AF/check.mjs arch.json`。`errors` 必须改；`warnings`、`layout` 逐条处理；打开 `<名字>-shots/index.html` 逐页看：标题、说明、画面对得上，光点按步骤走，全景图字不压线。改完重跑直到干净。
6. **交付：** `<名字>.html`（→ 翻页，A 自动播放，`?overview=1` 静态全景）、`<名字>-shots/overview.png`（放文档用）、`<名字>.outline.md`（页面清单，评审用）。只渲染：`node AF/render.mjs arch.json [--png]`。

## 页面怎么排

| 位置 | 必须有 |
|---|---|
| 第 1 页 | 全景：`draw:true`，一句 `caption` 说清整体分工 |
| 每个模块 1 页 | 管什么、跟谁交接、为什么这么切、代价——标题 + `caption` 说结论，画面上至少一样在动：`trace`、`flow`、`states` 或机制浮层 |
| 流程页 | `trace:"<流程id>"`，`edges:"all"` 或聚焦相关模块；步骤条 ≤7 个胶囊 |
| 收尾 | 主流程走一圈；需要时加状态归属表（出问题先查谁） |

模块按"一次请求经过的顺序"排，别从最抽象的底座讲起。总页数 6–12。

## 画面规矩

- 图要脱离讲解者也能看懂：结论写进 `caption`（≤48 字，`**关键词**` 标黄），细节放注释或浮层，不靠旁白。
- 节点 `label` 用"它干什么"的中文短语；真实类名可以出现在 `sub` 或模块标题里，方便对照源码。
- 只画源码能确认的。推论在 caption 里写"推测"；源码里没有的模块，用一页 `text` 浮层明说"没有"。
- 光点 `label` 写流的东西（"请求""工具结果"），连线 `label` 写关系（"调用模型"），两者别重复。

## 常见错误

| 错误 | 改法 |
|---|---|
| 一页只有高亮变暗，图是静的 | 加 `trace` / `flow` / `states` / 浮层 |
| 步骤条一长串，看不出重点 | 把中间转手的 `name`/`label` 去掉，变过路步骤 |
| 检查报"流程断开" | 调整步骤顺序或 `rev`；确实要跳的步骤加 `jump:true` |
| caption 压住最下一排节点 / 节点副标题被省略 | 看 `layout` 报告：调行 `h`、`gapY`、`nodeH` |
| 注释压住节点 | 换 `pos`，或直接删掉——结论已经在 caption 里就不要重复 |
| 有连线从没显示过 | 在某页 `edges` 点名，或删掉这条线 |

## 停下来重做的信号

- 想直接写 HTML / SVG → 回去写 `arch.json`。
- 没跑 `check.mjs`、没看截图就要交付 → 先跑、先看。
- 画面上有一个结论在源码里找不到依据 → 删掉，或标"推测"。
