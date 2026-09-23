#!/usr/bin/env node
/**
 * AgentForge Doctor —— Claude Code 插件结构与资产体检。
 *
 * 零依赖，只用 node: 内置模块。检查项：
 *   1. 插件清单与市场清单
 *   2. 组件目录位置（必须在插件根，不能嵌进 .claude-plugin/）
 *   3. 技能 frontmatter 与目录名一致性
 *   4. 子 agent frontmatter 与文件名一致性
 *   5. 只读 agent 不得声明写工具
 *   6. 外部依赖（mcp__* 引用）
 *   7. 技能内 references 引用是否都存在
 *   8. 硬编码绝对路径
 *
 * 用法：
 *   node tools/doctor.mjs [插件根目录]
 * 退出码：
 *   0 = 无 error；1 = 存在 error
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '..'))

const findings = []
const add = (level, area, msg, detail) => findings.push({ level, area, msg, detail })
const exists = (p) => {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}
const rel = (p) => path.relative(ROOT, p) || '.'

const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit'])
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** 解析 YAML frontmatter 子集（顶层键 + 单行标量 + 块标量）。 */
function parseFrontmatter(text) {
  const lines = text.split('\n')
  if (lines[0]?.trim() !== '---') return undefined
  let end = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      end = i
      break
    }
  }
  if (end === -1) return undefined

  const data = {}
  for (let i = 1; i < end; i += 1) {
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(lines[i])
    if (m === null) continue
    const key = m[1]
    const rest = m[2].trim()
    if (/^[|>][-+]?$/.test(rest)) {
      const buf = []
      let j = i + 1
      for (; j < end; j += 1) {
        const line = lines[j]
        if (line.trim() === '') {
          buf.push('')
          continue
        }
        if (!/^\s/.test(line)) break
        buf.push(line.replace(/^\s+/, ''))
      }
      i = j - 1
      data[key] = rest.startsWith('>') ? buf.join(' ').trim() : buf.join('\n').trim()
      continue
    }
    data[key] = rest === '' ? undefined : rest.replace(/^["']|["']$/g, '')
  }
  return { data, body: lines.slice(end + 1).join('\n') }
}

/* ─────────────────────── 1. 清单 ─────────────────────── */

function checkManifests() {
  const pluginPath = path.join(ROOT, '.claude-plugin', 'plugin.json')
  const marketPath = path.join(ROOT, '.claude-plugin', 'marketplace.json')

  let plugin
  if (!exists(pluginPath)) {
    add('error', 'manifest', '缺少 .claude-plugin/plugin.json', '这是 Claude Code 插件的必填清单')
  } else {
    try {
      plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf8'))
      if (!plugin.name) add('error', 'manifest', 'plugin.json 缺少 name')
      else if (!KEBAB.test(plugin.name)) add('error', 'manifest', `plugin.json 的 name="${plugin.name}" 不是 kebab-case`)
      if (!plugin.version) add('warn', 'manifest', 'plugin.json 缺少 version', '建议语义化版本，便于分发与回滚')
      if (!plugin.description) add('warn', 'manifest', 'plugin.json 缺少 description')
    } catch (e) {
      add('error', 'manifest', 'plugin.json 不是合法 JSON', String(e.message))
    }
  }

  if (!exists(marketPath)) {
    add('warn', 'manifest', '缺少 .claude-plugin/marketplace.json', '没有它就无法通过 /plugin marketplace add 安装')
    return
  }
  try {
    const market = JSON.parse(fs.readFileSync(marketPath, 'utf8'))
    if (!market.name) add('error', 'manifest', 'marketplace.json 缺少 name')
    if (!Array.isArray(market.plugins) || market.plugins.length === 0) {
      add('error', 'manifest', 'marketplace.json 的 plugins 为空')
    } else if (plugin?.name && !market.plugins.some((p) => p.name === plugin.name)) {
      add('error', 'manifest', `marketplace.json 未声明插件 "${plugin.name}"`)
    }
  } catch (e) {
    add('error', 'manifest', 'marketplace.json 不是合法 JSON', String(e.message))
  }
}

/* ─────────────────────── 2. 组件位置 ─────────────────────── */

function checkComponentLayout() {
  for (const dir of ['commands', 'agents', 'skills', 'hooks']) {
    if (exists(path.join(ROOT, '.claude-plugin', dir))) {
      add('error', 'layout', `${dir}/ 被放在了 .claude-plugin/ 内`, '组件目录必须在插件根级别，否则不会被自动发现')
    }
  }
  if (!exists(path.join(ROOT, 'skills')) && !exists(path.join(ROOT, 'agents'))) {
    add('warn', 'layout', '插件既没有 skills/ 也没有 agents/', '该插件不会提供任何能力')
  }
}

/* ─────────────────────── 3. 技能 ─────────────────────── */

function listSkills() {
  const dir = path.join(ROOT, 'skills')
  if (!exists(dir)) return []
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    if (e.isDirectory()) {
      const f = path.join(dir, e.name, 'SKILL.md')
      if (exists(f)) out.push({ name: e.name, file: f, kind: 'bundle' })
    } else if (e.name.endsWith('.md')) {
      out.push({ name: e.name.replace(/\.md$/, ''), file: path.join(dir, e.name), kind: 'flat' })
    }
  }
  return out
}

function checkSkills() {
  for (const skill of listSkills()) {
    const shown = rel(skill.file)
    const parsed = parseFrontmatter(fs.readFileSync(skill.file, 'utf8'))
    if (parsed === undefined) {
      add('error', 'skills', `${shown} 缺少 YAML frontmatter`, '技能必须有 name 与 description')
      continue
    }
    const { data, body } = parsed
    if (!data.name) add('error', 'skills', `${shown} 缺少 name`)
    else if (data.name !== skill.name) {
      add('error', 'skills', `${shown} 的 name="${data.name}" 与目录名 "${skill.name}" 不一致`)
    }
    if (!data.description) add('error', 'skills', `${shown} 缺少 description`, 'description 是模型触发技能的唯一依据')

    const dir = path.dirname(skill.file)
    for (const m of body.matchAll(/`(references\/[A-Za-z0-9._-]+)`/g)) {
      if (!exists(path.join(dir, m[1]))) add('error', 'skills', `${shown} 引用了不存在的 ${m[1]}`)
    }
  }

  const nested = []
  const walk = (dir, depth) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === '__pycache__') continue
      const p = path.join(dir, e.name)
      if (depth >= 2 && exists(path.join(p, 'SKILL.md'))) nested.push(p)
      if (depth < 4) walk(p, depth + 1)
    }
  }
  if (exists(path.join(ROOT, 'skills'))) walk(path.join(ROOT, 'skills'), 1)
  for (const p of nested) add('error', 'skills', `${rel(p)}/SKILL.md 是嵌套技能，不会被发现`)
}

/* ─────────────────────── 4. 子 agent ─────────────────────── */

function checkAgents() {
  const dir = path.join(ROOT, 'agents')
  if (!exists(dir)) return

  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue
    const full = path.join(dir, f)
    const shown = rel(full)
    const base = f.replace(/\.md$/, '')
    const parsed = parseFrontmatter(fs.readFileSync(full, 'utf8'))

    if (parsed === undefined) {
      add('error', 'agents', `${shown} 缺少 YAML frontmatter`)
      continue
    }
    const { data, body } = parsed
    if (!data.name) add('error', 'agents', `${shown} 缺少 name`)
    else if (data.name !== base) add('error', 'agents', `${shown} 的 name="${data.name}" 与文件名 "${base}" 不一致`)
    if (!data.description) add('error', 'agents', `${shown} 缺少 description`)

    const tools = (data.tools ?? '').split(',').map((t) => t.trim()).filter(Boolean)
    if (tools.length === 0) {
      add('warn', 'agents', `${shown} 未声明 tools 白名单`, '默认拥有全部工具，建议按最小权限声明')
    }

    const isReadOnly = /只报告|只读|不修改代码|不修改生产代码/.test(`${data.description ?? ''}\n${body}`)
    if (isReadOnly) {
      const leaked = tools.filter((t) => WRITE_TOOLS.has(t))
      if (leaked.length) add('error', 'agents', `${shown} 声称只读，但 tools 包含写工具：${leaked.join(', ')}`)
    }

    const mcp = [...body.matchAll(/mcp__([A-Za-z0-9_-]+)__/g)].map((m) => m[1])
    for (const s of [...new Set(mcp)]) {
      add('error', 'agents', `${shown} 依赖 MCP 服务 "mcp__${s}__*"`, '本插件承诺零外部依赖')
    }
    if (tools.some((t) => t.startsWith('mcp__'))) {
      add('error', 'agents', `${shown} 的 tools 白名单包含 MCP 工具`, '本插件承诺零外部依赖')
    }
  }
}

/* ─────────────────────── 5. 硬编码路径 ─────────────────────── */

function checkHardcodedPaths() {
  for (const d of ['skills', 'agents', 'commands', 'hooks']) {
    const full = path.join(ROOT, d)
    if (!exists(full)) continue
    const walk = (p) => {
      const st = fs.statSync(p)
      if (st.isDirectory()) {
        for (const e of fs.readdirSync(p)) {
          if (e === '__pycache__' || e === 'node_modules') continue
          walk(path.join(p, e))
        }
        return
      }
      if (!/\.(md|json|sh|js|mjs|py)$/i.test(p)) return
      const text = fs.readFileSync(p, 'utf8')
      const m = /(?:^|[\s"'(])(\/(?:Users|home)\/[A-Za-z0-9_.-]+\/[^\s"')]*)/.exec(text)
      if (m) add('warn', 'paths', `${rel(p)} 含硬编码绝对路径`, `${m[1]} —— 插件内应使用 \${CLAUDE_PLUGIN_ROOT}`)
    }
    walk(full)
  }
}

/* ─────────────────────── 报告 ─────────────────────── */

const ICON = { error: '🔴', warn: '🟡', info: 'ℹ️ ' }

function report() {
  const errors = findings.filter((f) => f.level === 'error')
  const warns = findings.filter((f) => f.level === 'warn')

  console.log(`\nAgentForge Doctor\n插件根：${ROOT}\n${'─'.repeat(64)}`)

  if (findings.length === 0) {
    console.log('\n✅ 插件结构与资产校验通过。\n')
    return 0
  }

  const ORDER = ['manifest', 'layout', 'skills', 'agents', 'paths']
  const areas = [...new Set(findings.map((f) => f.area))].sort(
    (a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99),
  )

  for (const area of areas) {
    console.log(`\n【${area}】`)
    for (const f of findings.filter((x) => x.area === area)) {
      console.log(`  ${ICON[f.level]} ${f.msg}`)
      if (f.detail) console.log(`     ↳ ${f.detail}`)
    }
  }

  console.log(`\n${'─'.repeat(64)}`)
  console.log(`合计：${errors.length} 个 error，${warns.length} 个 warn`)
  if (errors.length) console.log('存在 error 级问题。')
  console.log()
  return errors.length ? 1 : 0
}

/* ─────────────────────── main ─────────────────────── */

if (!exists(ROOT)) {
  console.error(`目录不存在：${ROOT}`)
  process.exit(2)
}

checkManifests()
checkComponentLayout()
checkSkills()
checkAgents()
checkHardcodedPaths()

process.exit(report())
