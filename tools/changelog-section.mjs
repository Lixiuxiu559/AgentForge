#!/usr/bin/env node
/**
 * 从 CHANGELOG.md 抽出指定版本的段落，供 GitHub Release 的正文使用。
 *
 * 用法：
 *   node tools/changelog-section.mjs 0.4.2      # 打印该版本的正文
 *   node tools/changelog-section.mjs 0.4.2 --with-heading
 *
 * 退出码：0 = 找到；1 = 该版本在 CHANGELOG 里不存在
 *
 * 为什么单独一个脚本：发布工作流需要把 CHANGELOG 的对应段落作为 Release 正文，
 * 用 shell + sed/awk 抽取这种带嵌套标题的 Markdown 很容易写错，而且没法在本地
 * 单测。放成脚本就能直接跑、直接验。
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md')

const args = process.argv.slice(2)
const version = args.find((a) => !a.startsWith('--'))
const withHeading = args.includes('--with-heading')

if (!version) {
  console.error('用法：node tools/changelog-section.mjs <x.y.z> [--with-heading]')
  process.exit(1)
}

const text = fs.readFileSync(CHANGELOG, 'utf8')
const lines = text.split('\n')

// 版本标题形如 `## [0.4.2] - 2026-09-25`（日期可有可无）。
// 用 startsWith 精确匹配方括号里的版本号，避免 0.4.2 误匹配到 0.4.20。
const wanted = `[${version}]`
let start = -1
for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i]
  if (!line.startsWith('## [')) continue
  const close = line.indexOf(']')
  if (close === -1) continue
  if (line.slice(3, close + 1) === wanted) {
    start = i
    break
  }
}

if (start === -1) {
  console.error(`❌ CHANGELOG.md 里找不到版本 [${version}] 的段落`)
  process.exit(1)
}

// 到下一个 `## [` 为止；文件末尾则到 EOF。
let end = lines.length
for (let i = start + 1; i < lines.length; i += 1) {
  if (lines[i].startsWith('## [')) {
    end = i
    break
  }
}

const body = lines
  .slice(withHeading ? start : start + 1, end)
  .join('\n')
  .replace(/^\s*---\s*$/gm, '') // 段尾的分隔线不属于正文
  .trim()

if (body === '') {
  console.error(`❌ [${version}] 的段落是空的`)
  process.exit(1)
}

process.stdout.write(`${body}\n`)
