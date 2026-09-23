/**
 * AgentForge —— DeepSeek Harness 桥接插件。
 *
 * 把仓库根的 `skills/` 与 `agents/` 注册进 DSH，让同一份文件在
 * Claude Code（走原生自动发现）和 DSH（走本插件）上产生一致的行为。
 *
 * 三个职责：
 *   1. 注册技能 —— 扫描 `skills/`，逐个交给 DSH 的技能注册表
 *   2. 注册子 agent —— 扫描 `agents/*.md`，注册成子 agent 工具（TODO）
 *   3. 挂载钩子桥 —— 指向仓库根的 `hooks/hooks.json`（TODO）
 *
 * 本文件是 AgentForge 里唯一的代码，刻意保持零依赖：只用 node: 内置模块，
 * 不 import 任何 `@deepseek-ai/*` —— 这样插件在任何 DSH 版本上都不会因
 * 依赖版本不一致而加载失败。
 *
 * @module agentforge
 */

import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { basename, dirname, join } from 'node:path'

/** Cordis 插件名。 */
export const name = 'agentforge'

/** 本插件向 DSH 注册的技能提供者名。 */
export const inject = ['skills']

const PROVIDER_NAME = 'agentforge'

/**
 * 与 `@deepseek-ai/dsh-skill` 的 `BUNDLED_SKILL_RANK` 保持一致（600）。
 * 刻意写死而不 import：避免对 DSH 内部包产生依赖，见模块注释。
 */
const BUNDLED_SKILL_RANK = 600

/** 技能真源目录 —— 由本文件位置推导，不依赖 cwd。 */
const SKILLS_DIR = fileURLToPath(new URL('../skills/', import.meta.url))

/* ────────────────────────── frontmatter 解析 ────────────────────────── */

const TRUE_VALUES = new Set(['true', 'yes', 'on', '1'])
const FALSE_VALUES = new Set(['false', 'no', 'off', '0'])

/** 把 frontmatter 的标量值归一化：去掉包裹引号。 */
function scalar(raw) {
  const v = raw.trim()
  if (v === '') return undefined
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
}

/**
 * 解析 SKILL.md 的 YAML frontmatter。
 *
 * 只支持 AgentForge 实际用到的子集：顶层键 + 单行标量 + `|` / `>` 块标量。
 * 不引入 YAML 库，因为技能 frontmatter 的形状完全由我们自己控制。
 *
 * @param text - 文件的完整内容。
 * @returns 解析出的字段与正文；没有合法 frontmatter 时返回 `undefined`。
 */
export function parseSkillFile(text) {
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

    // 块标量：`|` 保留换行，`>` 折成空格
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

    data[key] = scalar(rest)
  }

  return { data, body: lines.slice(end + 1).join('\n').replace(/^\n+/, '') }
}

/** 把 frontmatter 的布尔写法归一化；无法识别时返回 `undefined`。 */
function bool(raw) {
  if (raw === undefined) return undefined
  const v = String(raw).toLowerCase()
  if (TRUE_VALUES.has(v)) return true
  if (FALSE_VALUES.has(v)) return false
  return undefined
}

/* ────────────────────────── 技能扫描 ────────────────────────── */

/**
 * 扫描技能真源目录，产出 DSH 的候选列表。
 *
 * 形状与 `@deepseek-ai/dsh-skill-filesystem` 一致：目录包 `<name>/SKILL.md`
 * 或扁平文件 `<name>.md`，嵌套的 SKILL.md 不被发现。
 *
 * @returns 技能候选数组；目录不存在或不可读时返回空数组。
 */
async function scanSkills() {
  let entries
  try {
    entries = await readdir(SKILLS_DIR, { withFileTypes: true })
  } catch {
    return []
  }

  const candidates = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    let file
    if (entry.isDirectory()) {
      file = join(SKILLS_DIR, entry.name, 'SKILL.md')
    } else if (entry.name.endsWith('.md')) {
      file = join(SKILLS_DIR, entry.name)
    } else {
      continue
    }

    let text
    try {
      text = await readFile(file, 'utf8')
    } catch {
      continue
    }

    const parsed = parseSkillFile(text)
    if (parsed === undefined) continue
    const { data } = parsed

    // name 与 description 是 DSH 的硬性要求；缺任一项整条丢弃。
    if (data.name === undefined || data.description === undefined) continue

    candidates.push({
      name: data.name,
      description: data.description,
      ...(data.whenToUse === undefined ? {} : { whenToUse: data.whenToUse }),
      invocation: {
        // `disable-model-invocation: true` 把技能移出模型可见目录
        modelInvocable: bool(data['disable-model-invocation']) !== true,
        // `user-invocable: false` 把技能移出人类命令面板
        userInvocable: bool(data['user-invocable']) !== false,
      },
      provider: PROVIDER_NAME,
      source: 'bundled',
      rank: BUNDLED_SKILL_RANK,
      locator: file,
      path: file,
    })
  }

  return candidates
}

/* ────────────────────────── 技能提供者 ────────────────────────── */

const provider = {
  name: PROVIDER_NAME,

  /** 目录列表：每次调用重新扫描，新增/改名/删除技能无需重启。 */
  list: () => scanSkills(),

  /** 正文按需加载：catalog 只带 frontmatter，正文在技能真正被读时才读盘。 */
  async get(candidate) {
    const text = await readFile(candidate.locator, 'utf8')
    const parsed = parseSkillFile(text)
    return {
      name: candidate.name,
      description: candidate.description,
      ...(candidate.whenToUse === undefined ? {} : { whenToUse: candidate.whenToUse }),
      invocation: candidate.invocation,
      provider: PROVIDER_NAME,
      source: 'bundled',
      resourceBase: { kind: 'directory', path: dirname(candidate.locator) },
      content: parsed === undefined ? text : parsed.body,
      path: candidate.locator,
    }
  },
}

/**
 * 插件入口。
 *
 * `ctx.skills.registerProvider` 返回的 disposer 交给 fiber 管理，
 * 插件卸载时自动注销。
 *
 * @param ctx - Cordis 上下文；`skills` 由 `inject` 保证已就绪。
 */
export function apply(ctx) {
  ctx.skills.registerProvider(() => provider)
}
