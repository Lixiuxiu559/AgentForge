#!/usr/bin/env node
/**
 * AgentForge 发版脚本。
 *
 * 核心约定：`.claude-plugin/plugin.json` 的 `version` 是发版开关。
 * 不 bump 它，用户就收不到更新；bump 它并打标签才算发版。
 *
 * 用法：
 *   node tools/release.mjs patch              # 0.1.0 -> 0.1.1
 *   node tools/release.mjs minor              # 0.1.0 -> 0.2.0
 *   node tools/release.mjs major              # 0.1.0 -> 1.0.0
 *   node tools/release.mjs 0.2.3              # 显式版本
 *   node tools/release.mjs patch --dry-run    # 只预览
 *   node tools/release.mjs patch --push       # 发版并推送
 *
 * 退出码：0 = 成功；1 = 前置检查失败或参数错误
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const PLUGIN_JSON = path.join(ROOT, '.claude-plugin', 'plugin.json')
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md')

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith('--')))
const positional = argv.filter((a) => !a.startsWith('--'))
const bump = positional[0]

const DRY = flags.has('--dry-run')
const PUSH = flags.has('--push')

const die = (msg, hint) => {
  console.error(`\n❌ ${msg}`)
  if (hint) console.error(`   ${hint}`)
  process.exit(1)
}

const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts }).trim()

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

/* ─────────────────── 参数 ─────────────────── */

if (!bump) {
  die('缺少版本参数', '用法：node tools/release.mjs <patch|minor|major|x.y.z> [--dry-run] [--push]')
}

/* ─────────────────── 前置检查 ─────────────────── */

console.log('\nAgentForge 发版\n' + '─'.repeat(64))

// 1. 工作区干净
const dirty = git(['status', '--porcelain'])
if (dirty !== '') {
  die('工作区不干净，先提交或 stash', dirty.split('\n').slice(0, 5).join('\n   '))
}
console.log('✅ 工作区干净')

// 2. 在 main 分支
const branch = git(['branch', '--show-current'])
if (branch !== 'main') die(`当前分支是 "${branch}"，发版必须在 main 上`)
console.log('✅ 在 main 分支')

// 3. doctor 校验
try {
  execFileSync('node', [path.join(ROOT, 'tools', 'doctor.mjs')], { cwd: ROOT, stdio: 'pipe' })
  console.log('✅ doctor 校验通过')
} catch (e) {
  console.error(e.stdout?.toString() ?? '')
  die('doctor 校验未通过，修复后再发版')
}

// 4. 计算新版本
const plugin = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8'))
const current = plugin.version
if (typeof current !== 'string' || !SEMVER.test(current)) {
  die(`plugin.json 的 version="${current}" 不是合法 semver`)
}

const [maj, min, pat] = current.split('.').map(Number)
let next
if (bump === 'patch') next = `${maj}.${min}.${pat + 1}`
else if (bump === 'minor') next = `${maj}.${min + 1}.0`
else if (bump === 'major') next = `${maj + 1}.0.0`
else if (SEMVER.test(bump)) next = bump
else die(`无法识别的版本参数 "${bump}"`, '用 patch / minor / major，或显式 x.y.z')

if (next === current) die(`新版本与当前版本相同（${current}）`)
console.log(`✅ 版本：${current} → ${next}`)

// 5. tag 不存在
const tag = `v${next}`
try {
  git(['rev-parse', '--verify', `refs/tags/${tag}`], { stdio: 'pipe' })
  die(`标签 ${tag} 已存在`, '该版本已发过，换一个版本号')
} catch {
  /* 不存在，正常 */
}
console.log(`✅ 标签 ${tag} 未被占用`)

// 6. CHANGELOG 有 Unreleased 内容
const changelog = fs.readFileSync(CHANGELOG, 'utf8')
const unreleasedMatch = /^## \[Unreleased\]\s*\n([\s\S]*?)(?=^## \[|$(?![\s\S]))/m.exec(changelog)
if (!unreleasedMatch) {
  die('CHANGELOG.md 里找不到 "## [Unreleased]" 段')
}
const unreleasedBody = unreleasedMatch[1].trim()
if (unreleasedBody === '' || /^###\s*$/.test(unreleasedBody)) {
  die('CHANGELOG 的 Unreleased 段是空的', '先写清本次改动再发版')
}
console.log('✅ CHANGELOG 有 Unreleased 内容')

if (DRY) {
  console.log('\n' + '─'.repeat(64))
  console.log('--dry-run：未做任何修改。')
  console.log(`将要执行：bump ${current} → ${next}，提交 chore(release): ${tag}，打标签 ${tag}`)
  console.log()
  process.exit(0)
}

/* ─────────────────── 执行 ─────────────────── */

const today = new Date().toISOString().slice(0, 10)

// 7. 更新 plugin.json
plugin.version = next
fs.writeFileSync(PLUGIN_JSON, `${JSON.stringify(plugin, null, 2)}\n`)
console.log(`✅ 已更新 .claude-plugin/plugin.json`)

// 8. 更新 CHANGELOG：Unreleased 转为正式版本，并留一个空 Unreleased
const newUnreleased = `## [Unreleased]\n\n### Added\n\n- \n`
const releasedSection = unreleasedBody.replace(/^### /gm, '### ')
const updated = changelog.replace(
  /^## \[Unreleased\]\s*\n[\s\S]*?(?=^## \[|$(?![\s\S]))/m,
  `${newUnreleased}\n---\n\n## [${next}] - ${today}\n\n${releasedSection}\n\n`,
)
fs.writeFileSync(CHANGELOG, updated)
console.log('✅ 已更新 CHANGELOG.md')

// 9. 提交 + 打标签
git(['add', '.claude-plugin/plugin.json', 'CHANGELOG.md'])
git(['commit', '-m', `chore(release): ${tag}`])
console.log(`✅ 已提交 chore(release): ${tag}`)

git(['tag', '-a', tag, '-m', `AgentForge ${tag}`])
console.log(`✅ 已打标签 ${tag}`)

/* ─────────────────── 收尾 ─────────────────── */

console.log('\n' + '─'.repeat(64))
if (PUSH) {
  git(['push', '--follow-tags'], { stdio: 'inherit' })
  console.log(`\n🚀 已推送 ${tag} 到远程。用户执行 /plugin update 即可拿到 ${next}。\n`)
} else {
  console.log(`\n下一步：git push --follow-tags\n`)
  console.log(`（或在下次发版时加 --push 自动推送）\n`)
}
