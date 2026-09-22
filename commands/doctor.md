---
description: 体检 Claude Code 配置 —— 技能 frontmatter、hook matcher、子 agent 的 MCP 引用、配置漂移、明文密钥。
argument-hint: "[可选：要体检的目录，默认当前项目]"
allowed-tools: ["Bash(node:*)", "Read", "Glob", "Grep"]
---

# 配置体检

运行 AgentForge Doctor，对本项目的 `.claude/` 配置做一致性体检：

```!
node "${CLAUDE_PLUGIN_ROOT}/tools/doctor.mjs" $ARGUMENTS
```

（不传参数时默认体检当前工作目录。）

然后：

1. **按严重程度汇报** —— 先 🔴 error，再 🟡 warn，每项用一句话说清**影响**，不要复述脚本原文。
2. **对每个 error 给出具体修法** —— 不要只说「有问题」，给出可直接执行的修改。
3. **区分「必须修」和「可延后」** —— 明文密钥、永不触发的 hook 属于必须修。
4. **不要自动修改** —— 呈现方案，等用户确认后再动手。

## 常见问题的修法

| 问题 | 修法 |
|---|---|
| 技能缺 frontmatter | 文件开头加 `---`、`name: <目录名>`、`description: <做什么 + 何时用>`、`---` |
| hook matcher 写成 `Edit(*.yml)` | 改成 `"Edit\|Write"`，在脚本内读 stdin 的 `tool_input.file_path` 判断路径 |
| 子 agent 引用不存在的 MCP | 确认服务是否已下线/改名，或补进 `.mcp.json` |
| 明文密钥 | **先轮换密钥**，再改用 `${ENV_VAR}` 引用并加进 `.gitignore` |
| 技能内容跨端漂移 | 收敛到唯一真源，删除其余拷贝 |
