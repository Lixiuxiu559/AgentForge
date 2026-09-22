#!/usr/bin/env node
/**
 * AgentForge Doctor —— 多端 agent 资产体检
 *
 * 目的：在统一之前，先能量化「不一致」。
 *
 * 检查项：
 *   1. 技能 frontmatter 合法性（Claude Code / DSH 双端约束）
 *   2. hook matcher 正确性 + DSH 事件子集覆盖告警
 *   3. 子 agent 引用的 MCP 服务是否真实存在
 *   4. 各目标端（.claude/.agents/.codex/.qoder/.dsh）技能漂移
 *   5. MCP 配置中的明文凭据 + git 跟踪状态
 *
 * 用法：
 *   node tools/doctor.mjs [项目根目录]
 * 退出码：
 *   0 = 无 error；1 = 存在 error
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(process.argv[2] ?? process.cwd())
const TARGETS = ['.claude', '.agents', '.codex', '.qoder', '.dsh']
const MCP_CONFIG_FILES = [
  '.mcp.json',
  '.codex/config.toml',
  '.agents/config.toml',
  '.qoder/settings.json',
]

/** DSH 的 dsh-hooks-claude-code 支持的事件集合；不在其中的事件会被静默丢弃。 */
const DSH_SUPPORTED_HOOK_EVENTS = new Set([
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'SubagentStart',
  'SubagentStop',
])

/** Claude Code 已知的 hook 事件（用于识别"事件名写错"和"DSH 不支持"）。 */
const CC_KNOWN_HOOK_EVENTS = new Set([
  ...DSH_SUPPORTED_HOOK_EVENTS,
  'PostToolUseFailure',
  'Notification',
  'PreCompact',
  'SessionEnd',
  'SubagentStop',
  'TeammateIdle',
  'TaskCompleted',
])

const findings = []
const add = (level, area, msg, detail) => findings.push({ level, area, msg, detail })
const rel = (p) => path.relative(ROOT, p) || '.'
const exists = (p) => {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

/* ────────────────────────────── 1. 技能 ────────────────────────────── */

/** 解析 YAML frontmatter 的顶层键（只取键名与单行值，够用且无依赖）。 */
function parseFrontmatter(text) {
  if (!text.startsWith('---')) return null
  const end = text.indexOf('\n---', 3)
  if (end === -1) return null
  const keys = new Map()
  for (const raw of text.slice(3, end).split('\n')) {
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(raw)
    if (m) keys.set(m[1], m[2].trim())
  }
  return keys
}

/** 列出某个技能根下的技能：目录包 <name>/SKILL.md 与扁平 <name>.md。 */
function listSkills(skillRoot) {
  const out = []
  if (!exists(skillRoot)) return out
  for (const entry of fs.readdirSync(skillRoot, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue
    if (entry.isDirectory()) {
      const f = path.join(skillRoot, entry.name, 'SKILL.md')
      if (exists(f)) out.push({ name: entry.name, file: f, kind: 'bundle' })
    } else if (entry.name.endsWith('.md')) {
      out.push({ name: entry.name.replace(/\.md$/, ''), file: path.join(skillRoot, entry.name), kind: 'flat' })
    }
  }
  return out
}

/**
 * 技能包的完整内容指纹（忽略缓存与系统文件）。
 * 注意：路径必须相对于技能自身，否则 .claude/ 与 .agents/ 下同一技能会因前缀不同而全部误报为「不一致」。
 */
function hashSkill(skill) {
  const h = crypto.createHash('sha256')
  const base = skill.kind === 'bundle' ? path.dirname(skill.file) : skill.file
  const walk = (p) => {
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(p).sort()) {
        if (e === '__pycache__' || e === '.DS_Store' || e === '.git') continue
        walk(path.join(p, e))
      }
    } else {
      h.update(path.relative(base, p))
      h.update(fs.readFileSync(p))
    }
  }
  walk(base)
  return h.digest('hex').slice(0, 12)
}

function checkSkills() {
  const perTarget = new Map()

  for (const target of TARGETS) {
    const skillRoot = path.join(ROOT, target, 'skills')
    if (!exists(skillRoot)) continue
    const skills = listSkills(skillRoot)
    perTarget.set(target, skills)

    for (const skill of skills) {
      const text = fs.readFileSync(skill.file, 'utf8')
      const fm = parseFrontmatter(text)
      const shown = `${target}/skills/${path.basename(skill.file)}`

      if (!fm) {
        add('error', 'skills', `${shown} 缺少 YAML frontmatter —— DSH 会静默丢弃该技能`, '两端都要求 name + description')
        continue
      }
      if (!fm.get('name')) {
        add('error', 'skills', `${shown} 缺少 name 字段`, 'DSH 要求 name 必填，缺失即整条丢弃')
      } else if (fm.get('name') !== skill.name) {
        add(
          'error',
          'skills',
          `${shown} 的 name="${fm.get('name')}" 与目录名 "${skill.name}" 不一致`,
          '两端都以目录名索引，不一致会导致引用错乱',
        )
      }
      if (!fm.get('description')) {
        add('error', 'skills', `${shown} 缺少 description 字段`, 'DSH 要求 description 必填，缺失即整条丢弃')
      }
      for (const boolKey of ['disable-model-invocation', 'user-invocable']) {
        const v = fm.get(boolKey)
        if (v === undefined || v === '') continue
        if (!/^(true|false|yes|no|on|off|1|0)$/i.test(v)) {
          add(
            'error',
            'skills',
            `${shown} 的 ${boolKey}="${v}" 不是合法布尔值`,
            'DSH 遇到非法拼写会丢弃整个技能（只留警告，模型看不到）',
          )
        }
      }
    }

    // DSH 不扫描嵌套的 **/SKILL.md
    const nested = []
    const walkNested = (dir, depth) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory() || e.name === '__pycache__') continue
        const p = path.join(dir, e.name)
        if (depth >= 2 && exists(path.join(p, 'SKILL.md'))) nested.push(p)
        if (depth < 4) walkNested(p, depth + 1)
      }
    }
    walkNested(skillRoot, 1)
    for (const p of nested) {
      add('warn', 'skills', `${rel(p)}/SKILL.md 是嵌套技能，DSH 不会发现`, '技能必须位于扫描根的一级')
    }
  }

  return perTarget
}

/* ────────────────────────────── 2. Hooks ────────────────────────────── */

function checkHooks() {
  for (const target of TARGETS) {
    const settings = path.join(ROOT, target, 'settings.json')
    if (!exists(settings)) continue
    let cfg
    try {
      cfg = JSON.parse(fs.readFileSync(settings, 'utf8'))
    } catch (e) {
      add('error', 'hooks', `${rel(settings)} 不是合法 JSON`, String(e.message))
      continue
    }
    if (!cfg.hooks) continue

    for (const [event, groups] of Object.entries(cfg.hooks)) {
      if (!CC_KNOWN_HOOK_EVENTS.has(event)) {
        add('warn', 'hooks', `${rel(settings)} 出现未知事件 "${event}"`, '可能是拼写错误，Claude Code 会忽略')
      } else if (!DSH_SUPPORTED_HOOK_EVENTS.has(event)) {
        add(
          'warn',
          'hooks',
          `事件 "${event}" 在 DSH 上不受支持，会被静默跳过`,
          'dsh-hooks-claude-code 只支持 7 个事件；该 hook 在 DSH 侧等同不存在',
        )
      }
      if (!Array.isArray(groups)) continue

      groups.forEach((group, i) => {
        const where = `${rel(settings)} → hooks.${event}[${i}]`
        for (const key of Object.keys(group)) {
          if (key !== 'matcher' && key !== 'hooks') {
            add('warn', 'hooks', `${where} 含非标准键 "${key}"`, 'Claude Code 不识别该键，不要依赖它承载语义')
          }
        }
        const matcher = group.matcher
        if (matcher === undefined) return

        // Claude Code 的 matcher 是「工具名正则」，不是权限规则 glob
        if (/^[A-Za-z]+\s*\(/.test(matcher) || matcher.includes('*')) {
          add(
            'error',
            'hooks',
            `${where} 的 matcher="${matcher}" 是权限规则语法，不是 hook matcher —— 该 hook 永不触发`,
            'hook matcher 是对工具名的正则（如 "Edit|Write"）；文件路径判断要在脚本里读 tool_input.file_path',
          )
          return
        }
        try {
          new RegExp(matcher)
        } catch (e) {
          add('error', 'hooks', `${where} 的 matcher="${matcher}" 不是合法正则`, String(e.message))
        }
      })
    }
  }
}

/* ────────────────────────────── 3. 子 agent 的 MCP 引用 ────────────────────────────── */

/** 项目级 MCP 服务：.mcp.json + 项目内 cordis patch。 */
function readProjectMcpServerNames() {
  const names = new Set()
  const mcpJson = path.join(ROOT, '.mcp.json')
  if (exists(mcpJson)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(mcpJson, 'utf8'))
      for (const n of Object.keys(cfg.mcpServers ?? {})) names.add(n)
    } catch {
      /* JSON 错误已在别处报告 */
    }
  }
  for (const p of [path.join(ROOT, '.dsh', 'cordis.patch.yml'), path.join(ROOT, 'cordis.patch.yml')]) {
    if (!exists(p)) continue
    for (const m of fs.readFileSync(p, 'utf8').matchAll(/serverName:\s*([A-Za-z0-9_-]+)/g)) names.add(m[1])
  }
  return names
}

/**
 * 用户级 MCP 服务：Claude Code 的 ~/.claude.json 与 DSH 各 profile 的 cordis patch。
 * 用户级服务在项目里引用是合法的，不能误报为「未定义」。
 */
function readUserMcpServerNames() {
  const names = new Set()
  const home = process.env.HOME
  if (!home) return names

  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(home, '.claude.json'), 'utf8'))
    for (const n of Object.keys(cfg.mcpServers ?? {})) names.add(n)
    for (const proj of Object.values(cfg.projects ?? {})) {
      for (const n of Object.keys(proj?.mcpServers ?? {})) names.add(n)
    }
  } catch {
    /* 用户级配置不可读时静默跳过，避免产生误报 */
  }

  try {
    const profiles = path.join(home, '.dsh', 'profiles')
    for (const p of fs.readdirSync(profiles)) {
      const patch = path.join(profiles, p, 'cordis.patch.yml')
      if (!exists(patch)) continue
      for (const m of fs.readFileSync(patch, 'utf8').matchAll(/serverName:\s*([A-Za-z0-9_-]+)/g)) names.add(m[1])
    }
  } catch {
    /* 同上 */
  }

  return names
}

function checkAgentMcpRefs() {
  const projectScoped = readProjectMcpServerNames()
  const userScoped = readUserMcpServerNames()
  const defined = new Set([...projectScoped, ...userScoped])
  const agentsDir = path.join(ROOT, '.claude', 'agents')
  if (!exists(agentsDir)) return

  const referenced = new Map() // server -> Set(agentFile)
  for (const e of fs.readdirSync(agentsDir)) {
    if (!e.endsWith('.md')) continue
    const text = fs.readFileSync(path.join(agentsDir, e), 'utf8')
    const fm = parseFrontmatter(text)
    const tools = fm?.get('tools') ?? ''
    for (const m of tools.matchAll(/mcp__([A-Za-z0-9_-]+)__/g)) {
      if (!referenced.has(m[1])) referenced.set(m[1], new Set())
      referenced.get(m[1]).add(e)
    }
  }

  for (const [server, files] of referenced) {
    if (defined.has(server)) continue
    add(
      'error',
      'agents',
      `子 agent 引用了未定义的 MCP 服务 "mcp__${server}__*"`,
      `引用者：${[...files].join(', ')}；项目级已定义：${[...projectScoped].join(', ') || '（无）'}；` +
        `用户级已定义：${[...userScoped].join(', ') || '（无）'}`,
    )
  }
}

/* ────────────────────────────── 4. 跨端漂移 ────────────────────────────── */

function checkDrift(perTarget) {
  const targets = [...perTarget.keys()]
  if (targets.length < 2) return

  // 以技能数最多的目标为基准
  const base = targets.reduce((a, b) => (perTarget.get(a).length >= perTarget.get(b).length ? a : b))

  const fingerprint = (target) => {
    const map = new Map()
    for (const s of perTarget.get(target)) map.set(s.name, hashSkill(s))
    return map
  }
  const prints = new Map(targets.map((t) => [t, fingerprint(t)]))
  const basePrint = prints.get(base)

  for (const target of targets) {
    if (target === base) continue
    const p = prints.get(target)
    const missing = [...basePrint.keys()].filter((n) => !p.has(n))
    const extra = [...p.keys()].filter((n) => !basePrint.has(n))
    const diverged = [...p.keys()].filter((n) => basePrint.has(n) && basePrint.get(n) !== p.get(n))

    if (missing.length) {
      add(
        'warn',
        'drift',
        `${target}/skills 比 ${base}/skills 少 ${missing.length} 个技能`,
        missing.slice(0, 15).join(', ') + (missing.length > 15 ? ` … (+${missing.length - 15})` : ''),
      )
    }
    if (extra.length) {
      add('warn', 'drift', `${target}/skills 有 ${extra.length} 个技能不在 ${base}/skills 中`, extra.join(', '))
    }
    if (diverged.length) {
      add(
        'warn',
        'drift',
        `${target}/skills 有 ${diverged.length} 个技能与 ${base}/skills 内容不一致`,
        diverged.join(', '),
      )
    }
  }

  // hook 脚本漂移
  const hookHashes = new Map()
  for (const target of TARGETS) {
    const dir = path.join(ROOT, target, 'hooks')
    if (!exists(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f)
      if (!fs.statSync(full).isFile()) continue
      const h = crypto.createHash('md5').update(fs.readFileSync(full)).digest('hex').slice(0, 8)
      if (!hookHashes.has(f)) hookHashes.set(f, new Map())
      hookHashes.get(f).set(target, h)
    }
  }
  for (const [file, byTarget] of hookHashes) {
    const uniq = new Set(byTarget.values())
    if (byTarget.size > 1 && uniq.size > 1) {
      add(
        'warn',
        'drift',
        `hook 脚本 ${file} 存在 ${uniq.size} 个不同版本（${byTarget.size} 份拷贝）`,
        [...byTarget.entries()].map(([t, h]) => `${t}=${h}`).join('  '),
      )
    }
  }
}

/* ────────────────────────────── 5. 明文凭据 ────────────────────────────── */

const CRED_NAME = /(ACCESS_KEY|SECRET|TOKEN|PASSWORD|PASSWD|AUTHORIZATION|API_KEY|APIKEY|CREDENTIAL)/i

function isGitTracked(file) {
  try {
    execFileSync('git', ['-C', ROOT, 'ls-files', '--error-unmatch', rel(file)], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function checkSecrets() {
  for (const relPath of MCP_CONFIG_FILES) {
    const file = path.join(ROOT, relPath)
    if (!exists(file)) continue
    const tracked = isGitTracked(file)
    const hits = []

    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      const m = /^\s*"?([A-Za-z0-9_.\-]+)"?\s*[:=]\s*"([^"]{8,})"/.exec(line)
      if (!m) return
      const [, key, value] = m
      if (!CRED_NAME.test(key)) return
      if (value.includes('${') || value.includes('$(')) return // 已是引用，非明文
      hits.push({ line: i + 1, key, preview: value.slice(0, 8) + '***' })
    })

    if (hits.length) {
      add(
        tracked ? 'error' : 'warn',
        'secrets',
        `${relPath} 含 ${hits.length} 处明文凭据${tracked ? '，且已被 git 跟踪' : ''}`,
        hits.map((h) => `L${h.line} ${h.key}=${h.preview}`).join('  '),
      )
    }
  }
}

/* ────────────────────────────── 6. 插件结构 ────────────────────────────── */

/** 本脚本所在的插件根（tools/doctor.mjs 的上一级）。 */
const SELF_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** 校验一个 Claude Code 插件的结构是否符合官方约定。 */
function checkPlugin() {
  const manifest = path.join(SELF_ROOT, '.claude-plugin', 'plugin.json')
  if (!exists(manifest)) return

  let plugin
  try {
    plugin = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  } catch (e) {
    add('error', 'plugin', `.claude-plugin/plugin.json 不是合法 JSON`, String(e.message))
    return
  }

  if (!plugin.name) {
    add('error', 'plugin', 'plugin.json 缺少必填的 name 字段')
  } else if (!KEBAB.test(plugin.name)) {
    add('error', 'plugin', `plugin.json 的 name="${plugin.name}" 不是 kebab-case`, '官方要求小写字母加连字符')
  }
  if (!plugin.version) add('warn', 'plugin', 'plugin.json 缺少 version', '建议语义化版本，便于分发和回滚')

  // 组件目录必须在插件根，不能嵌进 .claude-plugin/
  for (const dir of ['commands', 'agents', 'skills', 'hooks']) {
    if (exists(path.join(SELF_ROOT, '.claude-plugin', dir))) {
      add('error', 'plugin', `${dir}/ 被放在了 .claude-plugin/ 里`, '组件目录必须在插件根级别，否则不会被自动发现')
    }
  }

  // 插件自身的技能必须合法（复用同一套规则）
  const own = listSkills(path.join(SELF_ROOT, 'skills'))
  for (const skill of own) {
    const fm = parseFrontmatter(fs.readFileSync(skill.file, 'utf8'))
    if (!fm?.get('name') || !fm?.get('description')) {
      add('error', 'plugin', `插件技能 skills/${skill.name} 的 frontmatter 不完整`, '需要 name + description')
    }
  }

  // agents 与 commands 的 frontmatter
  for (const [dir, required] of [
    ['agents', ['name', 'description']],
    ['commands', ['description']],
  ]) {
    const full = path.join(SELF_ROOT, dir)
    if (!exists(full)) continue
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith('.md')) continue
      const fm = parseFrontmatter(fs.readFileSync(path.join(full, f), 'utf8'))
      if (!fm) {
        add('error', 'plugin', `${dir}/${f} 缺少 YAML frontmatter`, `需要 ${required.join(' + ')}`)
        continue
      }
      for (const key of required) {
        if (!fm.get(key)) add('error', 'plugin', `${dir}/${f} 缺少 ${key} 字段`)
      }
    }
  }

  // 插件内不允许硬编码绝对路径，必须用 ${CLAUDE_PLUGIN_ROOT}
  const scanHardcoded = (dir) => {
    const full = path.join(SELF_ROOT, dir)
    if (!exists(full)) return
    for (const f of fs.readdirSync(full)) {
      const p = path.join(full, f)
      if (!fs.statSync(p).isFile()) continue
      const text = fs.readFileSync(p, 'utf8')
      const m = /(?:^|[\s"'(])(\/(?:Users|home)\/[A-Za-z0-9_.-]+\/[^\s"')]*)/.exec(text)
      if (m && !m[1].includes('${')) {
        add('warn', 'plugin', `${dir}/${f} 含硬编码绝对路径`, `${m[1]} —— 插件应使用 \${CLAUDE_PLUGIN_ROOT}`)
      }
    }
  }
  scanHardcoded('commands')
  scanHardcoded('hooks')
}

/**
 * 插件技能 vs 项目 .claude/skills 的漂移。
 * 这是 Claude Code 单端场景下最该关心的一致性：插件装了新版本，项目里还是旧拷贝。
 */
function checkPluginDrift(perTarget) {
  const projectSkills = perTarget.get('.claude')
  if (!projectSkills) return
  const pluginSkills = listSkills(path.join(SELF_ROOT, 'skills'))
  if (!pluginSkills.length) return

  const pluginPrint = new Map(pluginSkills.map((s) => [s.name, hashSkill(s)]))
  const projectPrint = new Map(projectSkills.map((s) => [s.name, hashSkill(s)]))

  const diverged = [...pluginPrint.keys()].filter((n) => projectPrint.has(n) && pluginPrint.get(n) !== projectPrint.get(n))
  const shadowed = [...pluginPrint.keys()].filter((n) => projectPrint.has(n))

  if (diverged.length) {
    add(
      'warn',
      'plugin-drift',
      `项目 .claude/skills 中有 ${diverged.length} 个技能与插件版本内容不同`,
      `${diverged.join(', ')} —— 项目内拷贝会覆盖插件版本，确认是有意覆盖还是忘了删`,
    )
  }
  if (shadowed.length && !diverged.length) {
    add(
      'info',
      'plugin-drift',
      `项目 .claude/skills 中有 ${shadowed.length} 个技能与插件完全重复`,
      '内容一致，但项目内拷贝无必要 —— 删掉即可让插件版本生效，避免将来漂移',
    )
  }
  const identical = shadowed.length - diverged.length
  if (identical > 0 && diverged.length) {
    add(
      'info',
      'plugin-drift',
      `另有 ${identical} 个技能与插件完全重复`,
      '这些可以直接从项目里删掉',
    )
  }
}

/**
 * 插件技能的「项目耦合」检测。
 *
 * 插件只该装通用能力。技能里出现具体项目的文档目录、monorepo 布局或产品名，
 * 说明它其实是项目资产 —— 换个项目就会给出错误路径，而且不报错。
 * 这类技能应移到 presets/<项目>/skills/ 由项目自己维护。
 */
const COUPLING_PATTERNS = [
  { re: /assets\/docs/g, label: '文档目录约定 (assets/docs)' },
  { re: /\bprojects\/[a-z][a-z0-9_.-]*\//g, label: "monorepo 路径 (projects/…)" },
  { re: /kuavo|lejurobot|lejugym|gym-cli|kuavotest|ossutil/gi, label: '产品/项目专有名' },
]

function checkSkillCoupling() {
  const root = path.join(SELF_ROOT, 'skills')
  if (!exists(root)) return

  for (const skill of listSkills(root)) {
    const dir = skill.kind === 'bundle' ? path.dirname(skill.file) : root
    const hits = new Map()

    const walk = (p) => {
      const st = fs.statSync(p)
      if (st.isDirectory()) {
        for (const e of fs.readdirSync(p)) {
          if (e === '__pycache__' || e === '.git') continue
          walk(path.join(p, e))
        }
        return
      }
      if (!/\.(md|txt|json|ya?ml)$/i.test(p)) return
      const text = fs.readFileSync(p, 'utf8')
      for (const { re, label } of COUPLING_PATTERNS) {
        const n = (text.match(re) ?? []).length
        if (n) hits.set(label, (hits.get(label) ?? 0) + n)
      }
    }
    walk(dir)

    if (hits.size) {
      add(
        'warn',
        'coupling',
        `插件技能 "${skill.name}" 耦合了具体项目约定`,
        [...hits.entries()].map(([l, n]) => `${l}×${n}`).join('，') +
          ' —— 应移到 presets/<项目>/skills/，或改为读 .claude/agentforge-conventions.md',
      )
    }
  }
}

/* ────────────────────────────── 报告 ────────────────────────────── */

const LEVEL_ICON = { error: '🔴', warn: '🟡', info: 'ℹ️ ' }

function report() {
  const errors = findings.filter((f) => f.level === 'error')
  const warns = findings.filter((f) => f.level === 'warn')
  const infos = findings.filter((f) => f.level === 'info')

  console.log(`\nAgentForge Doctor\n项目根：${ROOT}\n${'─'.repeat(64)}`)

  if (!findings.length) {
    console.log('\n✅ 未发现问题。\n')
    return 0
  }

  const ORDER = ['plugin', 'coupling', 'plugin-drift', 'skills', 'hooks', 'agents', 'drift', 'secrets']
  const areas = [...new Set(findings.map((f) => f.area))].sort(
    (a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99),
  )

  for (const area of areas) {
    console.log(`\n【${area}】`)
    for (const f of findings.filter((x) => x.area === area)) {
      console.log(`  ${LEVEL_ICON[f.level]} ${f.msg}`)
      if (f.detail) console.log(`     ↳ ${f.detail}`)
    }
  }

  console.log(`\n${'─'.repeat(64)}`)
  console.log(`合计：${errors.length} 个 error，${warns.length} 个 warn，${infos.length} 个 info`)
  if (errors.length) console.log('存在 error 级问题，建议先处理 🔴 项。')
  console.log()
  return errors.length ? 1 : 0
}

/* ────────────────────────────── main ────────────────────────────── */

if (!exists(ROOT)) {
  console.error(`目录不存在：${ROOT}`)
  process.exit(2)
}

const perTarget = checkSkills()
checkHooks()
checkAgentMcpRefs()
checkDrift(perTarget)
checkSecrets()
checkPlugin()
checkSkillCoupling()
checkPluginDrift(perTarget)

process.exit(report())
