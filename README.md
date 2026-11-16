# ArchFlow · 动态架构图

从 [ArchTalk](https://github.com/xiaonizhou-crypto/archtalk) 提炼出的纯架构图 / 流程演示 skill：去掉口播层，保留并加强"图 + 流程"。

- 写一份 `arch.json`（模块、连线、流程、页面）→ 单文件 HTML（→ 翻页）+ 静态全景 PNG + 页面清单
- `flows`：命名一次端到端流程，步骤条 + 连线编号 + 光点逐步演示，多页复用
- `caption`：每页底部一句结论，图脱离讲解者也能看懂
- `check.mjs`：静态规则 + 浏览器量版面 + 逐页截图

```bash
node scripts/check.mjs examples/deepseek-harness.json --out /tmp/af
node --test tests/security.test.mjs
```

格式见 `reference/spec.md`。MIT，派生自 ArchTalk（© 2026 xiaoni zhou / 心晴九天），画风参考岚叔动态架构图，见 THIRD_PARTY_NOTICES.md。
