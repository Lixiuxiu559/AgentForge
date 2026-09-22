#!/bin/bash
# 同步 CLAUDE.md ↔ AGENTS.md
# PostToolUse / PreToolUse hook：Write/Edit 之后，比较修改时间，最新者单向同步到对方
# 不依赖工具传参，Write 和 Edit 都能触发

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
cd "$PROJECT_DIR" || exit 0

# 找到项目根目录下的 CLAUDE.md 和 AGENTS.md
claude_md=$(find . -maxdepth 1 -name "CLAUDE.md" -not -name "CLAUDE.local.md" 2>/dev/null)
agents_md=$(find . -maxdepth 1 -name "AGENTS.md" 2>/dev/null)

# 至少一个文件存在才继续
[ -n "$claude_md" ] || [ -n "$agents_md" ] || exit 0

# 如果其中一个不存在，从另一个创建
if [ ! -f "$claude_md" ] && [ -f "$agents_md" ]; then
    cp "$agents_md" "$claude_md"
    echo "[HOOK] 已创建: $claude_md (来自 $agents_md)"
    exit 0
fi
if [ ! -f "$agents_md" ] && [ -f "$claude_md" ]; then
    cp "$claude_md" "$agents_md"
    echo "[HOOK] 已创建: $agents_md (来自 $claude_md)"
    exit 0
fi

# 两个文件都存在：比较修改时间，最新者单向同步
claude_time=$(stat -f %m "$claude_md" 2>/dev/null || stat -c %Y "$claude_md" 2>/dev/null)
agents_time=$(stat -f %m "$agents_md" 2>/dev/null || stat -c %Y "$agents_md" 2>/dev/null)

if [ "$claude_time" -gt "$agents_time" ]; then
    cp "$claude_md" "$agents_md"
    echo "[HOOK] 已同步: CLAUDE.md → AGENTS.md (CLAUDE.md 更新)"
elif [ "$agents_time" -gt "$claude_time" ]; then
    cp "$agents_md" "$claude_md"
    echo "[HOOK] 已同步: AGENTS.md → CLAUDE.md (AGENTS.md 更新)"
else
    # 时间相同但内容不同（极罕见）→ 以 CLAUDE.md 为准
    if ! cmp -s "$claude_md" "$agents_md"; then
        cp "$claude_md" "$agents_md"
        echo "[HOOK] 已同步: CLAUDE.md → AGENTS.md (默认方向)"
    fi
fi
