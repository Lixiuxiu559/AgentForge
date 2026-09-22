#!/usr/bin/env python3
"""把 body 片段包装成完整可双击打开的原型 HTML。

为什么需要这个脚本：原型里真正需要"想"的只有 body 内容（页面结构、字段、状态）。
外壳、CSS 内联、导航页都是机械劳动——交给脚本，可以保证多个页面视觉一致，
也让模型不必把同一份 CSS 重复写 N 遍。

用法：
    python3 build-prototype.py <prototype-dir>

输入（由调用方在 prototype-dir 下准备）：
    _meta.json          # 功能名/档位/PRD 路径/需求目录
    NN-xxx.body.html    # 页面 body 片段，首行是 <!-- title: 页面名 --> 注释

输出（脚本生成，不要手写）：
    NN-xxx.html         # 完整 HTML（内联 CSS + 顶部标注条）
    index.html          # 导航页
"""

import html
import json
import re
import sys
from pathlib import Path

CSS_PATH = Path(__file__).resolve().parent.parent / "assets" / "prototype.css"

TITLE_RE = re.compile(r"^\s*<!--\s*title:\s*(.+?)\s*-->\s*$", re.MULTILINE)


def esc(s: str) -> str:
    return html.escape(str(s), quote=True)


def wrap(body: str, title: str, meta: dict, nav: str = "") -> str:
    """把 body 片段包进完整 HTML，CSS 内联以便离线双击打开。"""
    css = CSS_PATH.read_text(encoding="utf-8")
    feature = esc(meta.get("feature", ""))
    tier = esc(meta.get("tier", ""))
    # PRD 与原型同级放在需求目录下（prototype/ 的上一级），故链接为 ../prd.md
    prd = meta.get("prd", "")
    prd_link = f'<a href="../{esc(prd)}">PRD</a>' if prd else ""
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)} — {feature} 原型</title>
<style>
{css}
</style>
</head>
<body>
<div class="proto-bar">
  <strong>原型</strong>
  <span>{feature}</span>
  <span class="tier">{tier}</span>
  <span>{esc(title)}</span>
  {nav}
  {prd_link}
</div>
<div class="proto-canvas">
{body.strip()}
</div>
</body>
</html>
"""


def build_index(entries: list, meta: dict) -> str:
    css = CSS_PATH.read_text(encoding="utf-8")
    feature = esc(meta.get("feature", ""))
    tier = esc(meta.get("tier", ""))
    cards = "\n".join(
        f'      <a class="btn" href="{esc(f)}">{esc(t)}</a>' for f, t in entries
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{feature} — 原型导航</title>
<style>
{css}
</style>
</head>
<body>
<div class="proto-bar">
  <strong>原型导航</strong>
  <span>{feature}</span>
  <span class="tier">{tier}</span>
</div>
<div class="proto-canvas">
  <div class="page-head">
    <h1>{feature}</h1>
    <p class="desc">共 {len(entries)} 个页面。逐页走查，确认布局、字段、交互与状态后，再进入架构设计。</p>
  </div>
  <div class="toolbar" style="flex-wrap:wrap;gap:12px">
{cards}
  </div>
</div>
</body>
</html>
"""


def main() -> int:
    if len(sys.argv) != 2:
        print("用法: python3 build-prototype.py <prototype-dir>", file=sys.stderr)
        return 2

    proto_dir = Path(sys.argv[1])
    if not proto_dir.is_dir():
        print(f"目录不存在: {proto_dir}", file=sys.stderr)
        return 1

    meta_file = proto_dir / "_meta.json"
    meta = json.loads(meta_file.read_text(encoding="utf-8")) if meta_file.exists() else {}

    fragments = sorted(proto_dir.glob("*.body.html"))
    if not fragments:
        print(f"没有找到 *.body.html 片段: {proto_dir}", file=sys.stderr)
        return 1

    entries = []
    for frag in fragments:
        raw = frag.read_text(encoding="utf-8")
        m = TITLE_RE.search(raw)
        if not m:
            print(f"缺少首行 title 注释: {frag.name}", file=sys.stderr)
            return 1
        title = m.group(1)
        body = TITLE_RE.sub("", raw, count=1)

        out_name = frag.name.replace(".body.html", ".html")
        prev_next = ""
        entries.append((out_name, title))
        (proto_dir / out_name).write_text(
            wrap(body, title, meta, prev_next), encoding="utf-8"
        )
        print(f"  ✓ {out_name}  ({title})")

    (proto_dir / "index.html").write_text(build_index(entries, meta), encoding="utf-8")
    print(f"  ✓ index.html  (导航页，{len(entries)} 个页面)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
