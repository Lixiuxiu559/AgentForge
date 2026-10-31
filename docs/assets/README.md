# README 视觉素材

首页头图与流程动图使用本地生成的素材，不依赖外部图片托管。内容是能力组合示意，不是宿主录屏，也不表示每次任务必须串行调用全部技能。

| 文件 | 用途 |
|---|---|
| `hero.png` | 首页产品头图，1280 × 540 |
| `workflow.gif` | research → implementation-workflow → diff-review 的循环示意，1280 × 510 |
| `workflow.png` | 流程静态版，供不希望观看动画的读者使用 |
| [render.swift](render.swift) | 全部视觉素材的可编辑生成源文件 |

在 macOS 仓库根目录重新生成（需要 Xcode Command Line Tools，自带 AppKit / ImageIO，无第三方依赖）：

```bash
swift -module-cache-path /tmp/agentforge-swift-cache docs/assets/render.swift
```

修改文案、布局、颜色或时序后运行以上命令，提交源文件和三个图片产物。素材沿用项目 [MIT 许可证](../../LICENSE)。
