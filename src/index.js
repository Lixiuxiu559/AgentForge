/**
 * AgentForge —— DeepSeek Harness 桥接插件。
 *
 * 把仓库根的 `skills/` 与 `agents/` 注册进 DSH，让同一份文件在
 * Claude Code（走原生自动发现）和 DSH（走本插件）上产生一致的行为。
 *
 * 三个职责：
 *   1. 注册技能 —— 扫描 `skills/`，逐个交给 DSH 的技能注册表
 *   2. 注册子 agent —— 扫描 `agents/*.md`，注册成一个 `agentforge` 工具，
 *      用 `agent` 参数枚举选择（DSH 没有 agents/*.md 的自动发现）
 *   3. 适配两端差异 —— 工具名映射、`${CLAUDE_PLUGIN_ROOT}` 展开、资源位置说明
 *
 * 本文件是 AgentForge 里唯一的代码，刻意保持零依赖：只用 node: 内置模块，
 * 不 import 任何 `@deepseek-ai/*` —— 这样插件在任何 DSH 版本上都不会因
 * 依赖版本不一致而加载失败。代价是工具定义要手写成 DSH 的
 * `ToolDefinition` 形状（而不是用 `defineTool`），见 `createAgentTool`。
 *
 * @module agentforge
 */

import { readdirSync, readFileSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

/** Cordis 插件名。 */
export const name = 'agentforge'

/**
 * 硬依赖的服务。
 *
 * 刻意**不**把 `subagents` 写进 inject：它是子 agent 的运行时依赖，但不是本插件
 * 存在的理由。若某个 profile 没挂 subagent provider，把 `subagents` 设为硬依赖
 * 会让整个插件（含技能注册）永久停在 waiting。改为调用期 `ctx.get('subagents')`。
 */
export const inject = ['skills', 'tools']

/** 本插件向 DSH 注册的技能提供者名。 */
const PROVIDER_NAME = 'agentforge'

/**
 * 与 `@deepseek-ai/dsh-skill` 的 `BUNDLED_SKILL_RANK` 保持一致（600）。
 * 刻意写死而不 import：避免对 DSH 内部包产生依赖，见模块注释。
 */
const BUNDLED_SKILL_RANK = 600

/** 默认的工具名。可被 patch 行的 `config.toolName` 覆盖；doctor 也读这个常量。 */
export const DEFAULT_TOOL_NAME = 'agentforge'

/** 默认的子 agent provider（dsh-base 里 `@deepseek-ai/dsh-subagent-spawn-in-process` 的名字）。 */
const DEFAULT_PROVIDER = 'spawn'

/**
 * DSH 已占用 / 保留的工具名，本插件不得占用。
 *
 * `subagent` / `subagent_fork` 由 dsh-base 的 `@deepseek-ai/dsh-tool-subagent` 注册；
 * `run_code` 是 DSH 在 `tools.register` 里显式校验的保留名。
 */
export const RESERVED_TOOL_NAMES = Object.freeze(['run_code', 'subagent', 'subagent_fork'])

/**
 * 包根目录（仓库根）—— 由本文件位置推导，不依赖 cwd。
 *
 * 用 `resolve` 而不是 `fileURLToPath(new URL('..', ...))`：后者会带一个尾部分隔符，
 * 展开 `${CLAUDE_PLUGIN_ROOT}/skills/...` 时会拼出 `//skills`。
 */
export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 技能真源目录。 */
const SKILLS_DIR = join(PACKAGE_ROOT, 'skills')

/** 子 agent 真源目录。 */
const AGENTS_DIR = join(PACKAGE_ROOT, 'agents')

/**
 * Claude Code 工具名 → DSH 工具名。
 *
 * 两端工具名是**两套命名**（CC 用 `Read`/`Grep`/`WebSearch`，DSH 用
 * `read`/`grep`/`web_search`）。若直接把 CC 白名单交给 DSH 的
 * `tools.restrict({ allow })`，会因为「未知工具名」直接抛错，子 agent 一个都跑不起来。
 *
 * 未列出的名字（例如 CC 的 `NotebookEdit`、`Task`）在 DSH 侧没有对应物，
 * 会被丢弃并在调用期记一条 warning —— `tools/doctor.mjs` 会静态报出来。
 *
 * @type {Readonly<Record<string, string>>}
 */
export const CC_TO_DSH_TOOL_NAMES = Object.freeze({
  Read: 'read',
  Glob: 'glob',
  Grep: 'grep',
  Bash: 'bash',
  Edit: 'edit',
  Write: 'write',
  WebSearch: 'web_search',
  WebFetch: 'web_fetch',
  TodoWrite: 'todo_write',
  Skill: 'skill',
})

/** Claude Code 的模型别名 —— DSH 侧不认识，默认忽略。 */
const CC_MODEL_ALIASES = new Set(['haiku', 'sonnet', 'opus', 'inherit', 'default'])

/**
 * DSH 没有 `${CLAUDE_PLUGIN_ROOT}` 变量（那是 Claude Code 的约定）。
 * 注册时把占位符展开成真实包路径，让两端共用同一份可移植文本。
 */
const PLUGIN_ROOT_PLACEHOLDER = '${CLAUDE_PLUGIN_ROOT}'

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
 * 解析 markdown 文件的 YAML frontmatter（技能与子 agent 共用）。
 *
 * 只支持 AgentForge 实际用到的子集：顶层键 + 单行标量 + `|` / `>` 块标量。
 * 不引入 YAML 库，因为 frontmatter 的形状完全由我们自己控制。
 *
 * @param text - 文件的完整内容。
 * @returns 解析出的字段与正文；没有合法 frontmatter 时返回 `undefined`。
 */
export function parseFrontmatterFile(text) {
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

/** `parseFrontmatterFile` 的对外旧名，保持可用（仓库内已无使用者）。 */
export const parseSkillFile = parseFrontmatterFile

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

    const parsed = parseFrontmatterFile(text)
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
    const parsed = parseFrontmatterFile(text)
    const body = parsed === undefined ? text : parsed.body
    return {
      name: candidate.name,
      description: candidate.description,
      ...(candidate.whenToUse === undefined ? {} : { whenToUse: candidate.whenToUse }),
      invocation: candidate.invocation,
      provider: PROVIDER_NAME,
      source: 'bundled',
      resourceBase: { kind: 'directory', path: dirname(candidate.locator) },
      // DSH 没有 ${CLAUDE_PLUGIN_ROOT}，注册时展开成真实包路径
      content: expandPluginRoot(body),
      path: candidate.locator,
    }
  },
}

/* ────────────────────────── 子 agent 扫描 ────────────────────────── */

/** 把 `${CLAUDE_PLUGIN_ROOT}` 展开成包根目录的真实路径。 */
function expandPluginRoot(text) {
  return text.split(PLUGIN_ROOT_PLACEHOLDER).join(PACKAGE_ROOT)
}

/** 解析 `tools: Read, Glob, Grep` 这一类逗号分隔的白名单。 */
function parseToolList(raw) {
  if (raw === undefined) return []
  return String(raw)
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '')
}

/**
 * 把 CC 的工具白名单翻译成 DSH 工具名。
 *
 * @returns `{ names, dropped }`；`dropped` 是两端无法映射的名字，调用期会记 warning。
 */
function translateToolNames(ccNames) {
  const names = []
  const dropped = []
  for (const ccName of ccNames) {
    const mapped = CC_TO_DSH_TOOL_NAMES[ccName]
    if (mapped === undefined) {
      dropped.push(ccName)
      continue
    }
    if (!names.includes(mapped)) names.push(mapped)
  }
  return { names, dropped }
}

/**
 * 扫描子 agent 真源目录。
 *
 * 与技能不同，这里必须**同步**读盘：工具定义（含 description 里的 agent 清单）
 * 要在 `apply()` 期间一次性交给 `ctx.tools.register()`，没有「按需重扫」的机会。
 * 因此新增 agent 需要重载插件（DSH 的 patchReload 会处理）。
 *
 * @returns 子 agent 定义数组；目录不存在或不可读时返回空数组。
 */
export function scanAgents() {
  let entries
  try {
    entries = readdirSync(AGENTS_DIR, { withFileTypes: true })
  } catch {
    return []
  }

  const agents = []
  for (const entry of entries) {
    if (entry.name.startsWith('.') || !entry.name.endsWith('.md')) continue
    // 目录包形式（`<name>/AGENT.md`）在 CC 侧不存在，跳过，保持一致
    if (!entry.isFile()) continue

    const file = join(AGENTS_DIR, entry.name)
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }

    const parsed = parseFrontmatterFile(text)
    if (parsed === undefined) continue
    const { data, body } = parsed

    // name 与 description 缺任一项整条丢弃：工具描述与 enum 需要它们。
    if (data.name === undefined || data.description === undefined) continue

    const declared = parseToolList(data.tools)
    const { names, dropped } = translateToolNames(declared)

    agents.push({
      name: data.name,
      description: data.description,
      /** 声明但两端不互通的名字，用于调用期 warning。 */
      droppedTools: dropped,
      /** DSH 侧可用的工具名（调用期还要与真实注册表求交集）。 */
      dshTools: names,
      /** CC 的模型别名，DSH 侧默认忽略；可用 config.agents 覆盖。 */
      ccModel: data.model,
      /** CC 的 maxTurns 在 DSH 没有对应物，仅记录。 */
      ccMaxTurns: data.maxTurns,
      persona: body.trim(),
      path: file,
    })
  }

  agents.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return agents
}

/* ────────────────────────── 子 agent 运行时 ────────────────────────── */

/**
 * 给子 agent 的 persona 前置一段资源位置说明。
 *
 * 两端共享同一份 agent 定义，而定义里的路径是按「插件根」写的
 * （`skills/<name>/references/...`）。CC 靠约定的插件根解析它们，DSH 没有这个约定，
 * 所以由桥接插件把根目录明确写进子 agent 的系统提示词。
 */
function buildPersona(agent) {
  const body = expandPluginRoot(agent.persona)
  return [
    '## AgentForge 资源位置',
    '',
    `本插件（AgentForge）的根目录：\`${PACKAGE_ROOT}\``,
    '',
    '- 技能正文：`<根目录>/skills/<技能名>/SKILL.md`',
    '- 语言适配说明与参考：`<根目录>/skills/<技能名>/references/`',
    '- 脚本：`<根目录>/skills/<技能名>/scripts/`',
    '',
    '下文出现的相对路径（如 `skills/...`）都以上面的根目录为基准；',
    '原本用于定位插件根的占位符已被替换成该绝对路径，直接使用即可。',
    '需要更详细的规则时，用 read 直接读对应文件。',
    '',
    '---',
    '',
    body,
  ].join('\n')
}

/**
 * 计算交给 DSH `toolFilter` 的白名单。
 *
 * 调用期才与真实注册表求交集，原因有二：
 *   1. `tools.restrict({ allow })` 对**未知工具名**直接抛错，而 `apply()` 时其它行
 *      可能还没注册完，静态判断会误伤（例如 profile 没挂 `dsh-tool-web` 时 `web_search` 不存在）；
 *   2. 交集为空时不能传空 allow（空 filter 同样抛错），此时宁可退回「不过滤」。
 *
 * @param ctx - 插件上下文（需含 `tools` 服务）。
 * @param agent - `scanAgents()` 的产物。
 * @returns `{ allow }` 或 `undefined`（声明为空 / 全部不可用）。
 */
function resolveToolFilter(ctx, agent) {
  if (agent.dshTools.length === 0) return undefined
  const available = agent.dshTools.filter((toolName) => ctx.tools.get(toolName) !== undefined)
  if (available.length === 0) return undefined
  return { allow: available }
}

/** 读取 patch 行 `config.agents.<name>` 里的显式模型覆盖。 */
function resolveAgentOptions(config, agentName) {
  const override = config?.agents?.[agentName]
  if (override === undefined || override === null || typeof override !== 'object') return undefined

  const options = {}
  if (typeof override.provider === 'string' && override.provider !== '') options.provider = override.provider
  if (typeof override.model === 'string' && override.model !== '') options.model = override.model
  if (typeof override.reasoningEffort === 'string' && override.reasoningEffort !== '') {
    options.reasoningEffort = override.reasoningEffort
  }
  return Object.keys(options).length === 0 ? undefined : options
}

/** 子 agent 非正常结束时的说明文案。 */
const STOP_REASON_TEXT = {
  aborted: '子 agent 运行被取消',
  error: '子 agent 运行失败',
  'max-tokens': '子 agent 在完成前触发 token 上限',
  refusal: '子 agent 拒绝了该任务',
}

/** 从 ContentBlock[] 里取出纯文本（与官方 subagent 工具一致）。 */
function outputText(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter((block) => typeof block === 'object' && block !== null && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')
}

/**
 * 收集一次前台子 agent 运行并释放它。
 *
 * 与官方 `settleForegroundRun` 同构：先取结果再 dispose，且 dispose 失败
 * 不能掩盖真正的失败原因。
 */
async function collectRun(run) {
  const [settled] = await Promise.allSettled([run.result])
  const [disposed] = await Promise.allSettled([Promise.resolve().then(() => run.dispose())])

  if (settled.status === 'rejected') {
    if (disposed.status === 'rejected') {
      throw new AggregateError(
        [settled.reason, disposed.reason],
        `子 agent 运行失败：${String(settled.reason)}；释放运行也失败：${String(disposed.reason)}`,
      )
    }
    throw settled.reason
  }
  if (disposed.status === 'rejected') throw disposed.reason

  const result = settled.value ?? {}
  const text = outputText(result.output)

  if (result.stopReason !== 'completed') {
    const head = STOP_REASON_TEXT[result.stopReason] ?? `子 agent 异常结束（${String(result.stopReason)}）`
    const diagnostic = result.diagnostic === undefined ? '' : `\n诊断：${result.diagnostic}`
    throw new Error(`${head}${diagnostic}${text === '' ? '' : `\n结束前的部分输出：\n${text}`}`)
  }

  return text === '' ? '（子 agent 未返回文本输出）' : text
}

/**
 * 已经告警过的「被丢弃的工具名」，按 agent 名去重。
 * 只在签名变化时重新告警，避免每次委派都刷同一条 warning。
 */
const droppedWarnings = new Map()

/**
 * 构造 `agentforge` 工具定义。
 *
 * 手写 `ToolDefinition`（而不是 `defineTool`）是零依赖的直接后果：参数用标准
 * JSON Schema，`execute` 自己校验参数，`output.schema` 只使用 DSH 支持的子集
 * （type / properties / required / additionalProperties / enum）。
 *
 * @param ctx - 插件上下文。
 * @param agents - `scanAgents()` 的产物。
 * @param config - patch 行的 config。
 * @param toolName - 已经确定并校验过的工具名。
 */
function createAgentTool(ctx, agents, config, toolName) {
  const names = agents.map((a) => a.name)
  const provider = typeof config?.provider === 'string' && config.provider !== '' ? config.provider : DEFAULT_PROVIDER

  const description = [
    '委派一项任务给 AgentForge 预定义子 agent，取回它的最终结论。',
    '每个子 agent 有独立的系统提示词和工具白名单（只读 agent 不持有写工具），适合需要隔离上下文或严格边界的任务。',
    '',
    '可用 agent：',
    ...agents.map((a) => `- ${a.name}: ${a.description}`),
  ].join('\n')

  return {
    name: toolName,
    description,
    parameters: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          enum: names,
          description: '要运行哪个子 agent。',
        },
        prompt: {
          type: 'string',
          description: '给子 agent 的完整、自包含任务：它看不到当前对话，必须把背景、目标和期望产物写清楚。',
        },
        description: {
          type: 'string',
          description: '3-5 个词的短标签，用于展示。',
        },
      },
      required: ['agent', 'prompt', 'description'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          agent: { type: 'string' },
          output: { type: 'string' },
        },
        required: ['agent', 'output'],
        additionalProperties: false,
      },
      render(_args, value) {
        return [{ type: 'text', text: value.output }]
      },
    },
    // 委派本身不改父 agent 的状态，且实现编排工作流要靠它并行派发
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const requested = typeof args?.agent === 'string' ? args.agent : ''
      const agent = agents.find((a) => a.name === requested)
      if (agent === undefined) {
        throw new Error(`未知的 AgentForge 子 agent "${requested}"；可用：${names.join(', ')}`)
      }

      const prompt = typeof args?.prompt === 'string' ? args.prompt.trim() : ''
      if (prompt === '') throw new Error('prompt 不能为空：子 agent 看不到当前对话，必须给出自包含的任务描述。')

      const parent = exec.agent
      if (parent === undefined) throw new Error(`${toolName} 工具必须在 Agent 会话中调用（exec.agent 为空）`)

      const subagents = ctx.get('subagents')
      if (subagents === undefined) {
        throw new Error('DSH 未挂载 subagents 服务：需要 @deepseek-ai/dsh-subagent 及至少一个 provider（如 spawn）')
      }

      if (agent.droppedTools.length > 0) {
        // 只在变化时告警一次：这两个名字是按 agent 固定的，按次告警会刷屏
        const signature = agent.droppedTools.join(',')
        if (droppedWarnings.get(agent.name) !== signature) {
          droppedWarnings.set(agent.name, signature)
          ctx.logger?.warn?.(
            `[agentforge] 子 agent "${agent.name}" 声明的工具在 DSH 无对应物，已忽略：${signature}`,
          )
        }
      }

      const request = {
        label: typeof args?.description === 'string' && args.description.trim() !== '' ? args.description.trim() : agent.name,
        prompt: [{ type: 'text', text: prompt }],
        parent,
        signal: exec.signal,
        persona: buildPersona(agent),
      }

      const filter = resolveToolFilter(ctx, agent)
      if (filter !== undefined) request.toolFilter = filter

      const agentOptions = resolveAgentOptions(config, agent.name)
      if (agentOptions !== undefined) request.agentOptions = agentOptions

      const run = await subagents.start(provider, request)
      return { agent: agent.name, output: await collectRun(run) }
    },
  }
}

/* ────────────────────────── 插件入口 ────────────────────────── */

/**
 * 插件入口。
 *
 * 两个注册动作共享同一次 `apply`：`ctx.skills.registerProvider` 与
 * `ctx.tools.register` 都返回 disposer，由 Cordis fiber 管理，插件卸载时自动清理。
 *
 * @param ctx - Cordis 上下文；`skills` / `tools` 由 `inject` 保证已就绪。
 * @param config - patch 行的 `config`（可选）：
 *   - `toolName`：覆盖默认工具名（默认 `agentforge`）
 *   - `provider`：覆盖子 agent provider 名（默认 `spawn`）
 *   - `agents.<name>.{provider,model,reasoningEffort}`：单 agent 的模型覆盖
 */
export function apply(ctx, config) {
  // 先校验、后注册：apply 抛错时整个 fiber 的 effect 都会被回滚，
  // 所以把可能失败的检查放在最前面，避免读者误以为失败的插件还留下半个注册。
  const toolName = typeof config?.toolName === 'string' && config.toolName !== '' ? config.toolName : DEFAULT_TOOL_NAME
  if (RESERVED_TOOL_NAMES.includes(toolName)) {
    throw new Error(`[agentforge] 工具名 "${toolName}" 是 DSH 保留名，请用 config.toolName 指定别的名字`)
  }
  if (ctx.tools.get(toolName) !== undefined) {
    throw new Error(`[agentforge] 工具名 "${toolName}" 已被其它插件占用，请用 config.toolName 指定别的名字`)
  }

  ctx.skills.registerProvider(() => provider)

  const agents = scanAgents()
  if (agents.length === 0) {
    ctx.logger?.warn?.('[agentforge] 没有扫描到任何子 agent（agents/*.md），子 agent 工具不会被注册')
    return
  }

  ctx.tools.register(createAgentTool(ctx, agents, config, toolName))
}
