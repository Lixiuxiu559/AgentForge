# README 视觉素材

首页头图与流程动图提供**简体中文和英文两套**，共用布局、配色与动画时序。[中文 README](../../README.md) 使用 `zh-CN` 版，[英文 README](../../README.en.md) 使用 `en` 版。品牌名、宿主名和技能标识符保持原样。

| 素材 / Asset | 简体中文 | English | 尺寸 / Size |
|---|---|---|---|
| 产品头图 / Hero | [hero.zh-CN.png](hero.zh-CN.png) | [hero.en.png](hero.en.png) | 1280 × 540 |
| 能力动图 / Animation | [workflow.zh-CN.gif](workflow.zh-CN.gif) | [workflow.en.gif](workflow.en.gif) | 1280 × 590 |
| 静态图 / Still | [workflow.zh-CN.png](workflow.zh-CN.png) | [workflow.en.png](workflow.en.png) | 1280 × 590 |

Both sets show Project Wiki, investigation, implementation and review. Use the matching language in your README or product introduction. All assets are generated locally and require no external image hosting.

内容是能力组合示意，不是宿主录屏，也不表示每次任务必须串行调用全部技能。The animation illustrates capabilities; it is not a host recording or a mandatory sequence.

[render.swift](render.swift) 是两套素材共用的可编辑源文件。

在 macOS 仓库根目录重新生成（需要 Xcode Command Line Tools，自带 AppKit / ImageIO，无第三方依赖）：

```bash
swift -module-cache-path /tmp/agentforge-swift-cache docs/assets/render.swift
```

修改文案、布局、颜色或时序后运行以上命令，一次生成两套共六个图片文件，并提交源文件和产物。素材沿用项目 [MIT 许可证](../../LICENSE)。
