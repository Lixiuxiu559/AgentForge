#!/usr/bin/env bash
# 人在回路的复现循环。
# 复制这个文件，编辑下面的步骤，然后运行它。
# Agent 运行脚本；用户在自己的终端里跟随提示。
#
# 用法：
#   bash hitl-loop.template.sh
#
# 两个辅助函数：
#   step "<指令>"          → 显示指令，等待回车
#   capture VAR "<问题>"   → 显示问题，把回答读入 VAR
#
# 结束时，捕获的值以 KEY=VALUE 打印出来供 agent 解析。
#
# `capture` 把值打印回终端，agent 在那里读到它——所以用 capture 捕获观察，
# 把登录这类操作留给用户做 `step`。

set -euo pipefail

step() {
  printf '\n>>> %s\n' "$1"
  read -r -p "    [完成后回车] " _
}

capture() {
  local var="$1" question="$2" answer
  printf '\n>>> %s\n' "$question"
  read -r -p "    > " answer
  printf -v "$var" '%s' "$answer"
}

# --- 在下面编辑 ---------------------------------------------------------

step "打开 http://localhost:3000 并登录。"

capture ERRORED "点击 'Export' 按钮。它报错了吗？(y/n)"

capture ERROR_MSG "粘贴错误信息（或 'none'）："

# --- 在上面编辑 ---------------------------------------------------------

printf '\n--- 已捕获 ---\n'
printf 'ERRORED=%s\n' "$ERRORED"
printf 'ERROR_MSG=%s\n' "$ERROR_MSG"
