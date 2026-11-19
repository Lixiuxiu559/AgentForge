#!/usr/bin/env node
/**
 * 共享 HTML 蓝图的渲染与交付检查。
 *
 *   node render-blueprint.mjs --data <字段.json|-> --out <产物.html>
 *   node render-blueprint.mjs --check <产物.html> [--expect-h1 <正文标题>]
 *
 * 字段名从模板中的 {{...}} 自动提取；JSON 必须不多不少覆盖全部字段。
 * text 字段自动转义，其余原样插入。渲染后强制检查残留占位符和正文 h1。
 * 退出码：0 = 通过；1 = 字段缺失、残留占位符或 h1 不一致。
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HERE = import.meta.dirname
export const DEFAULT_TEMPLATE = path.resolve(HERE, '../assets/document-themes/blueprint.html')
const PLACEHOLDER = /\{\{([^{}]+)\}\}/g
const ANY_PLACEHOLDER = /\{\{([^{}\n]*)\}\}/g
const TEXT_FIELDS = new Set([
  'DOCUMENT_LANG', 'DOCUMENT_TITLE', 'DOCUMENT_TYPE', 'DOC_BRAND_MARK', 'DOC_BRAND',
  'DOC_KIND_LABEL', 'HERO_EYEBROW', 'DOCUMENT_H1', 'DOCUMENT_SUBTITLE',
])

/**
 * 读取蓝图模板，提取字段名。
 *
 * @param {string} [templatePath]
 * @returns {{ template: string, fields: string[], templatePath: string }}
 */
export function loadTemplate(templatePath = DEFAULT_TEMPLATE) {
  const resolved = path.resolve(templatePath)
  let template
  try {
    template = fs.readFileSync(resolved, 'utf8')
  } catch (error) {
    throw new Error(`无法读取蓝图模板 ${resolved}：${error.message}`)
  }
  const fields = [...new Set(
    [...template.matchAll(PLACEHOLDER)].map((match) => match[1].trim()),
  )]
  if (fields.length === 0) throw new Error('模板中没有找到 {{...}} 占位符')
  return { template, fields, templatePath: resolved }
}

/**
 * 按模板字段渲染。渲染后立即检查，不返回未通过检查的半成品。
 *
 * @param {{ template: string, fields: string[], data: Record<string, string> }} input
 * @returns {string}
 */
export function renderBlueprint({ template, fields, data }) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('字段数据必须是 JSON 对象')
  }

  const missing = fields.filter((name) => !Object.hasOwn(data, name))
  const unknown = Object.keys(data).filter((name) => !fields.includes(name))
  if (missing.length > 0) throw new Error(`缺少字段：${missing.join(', ')}`)
  if (unknown.length > 0) throw new Error(`未知字段：${unknown.join(', ')}`)

  for (const name of ['DOCUMENT_TITLE', 'DOCUMENT_H1', 'DOCUMENT_SECTIONS']) {
    if (!Object.hasOwn(data, name)) continue
    if (typeof data[name] !== 'string' || data[name].trim() === '') {
      throw new Error(`字段 ${name} 不能为空`)
    }
  }

  const values = {}
  for (const name of fields) {
    const raw = data[name]
    if (typeof raw !== 'string') throw new Error(`字段 ${name} 的值必须是字符串`)
    values[name] = TEXT_FIELDS.has(name) ? escapeHtml(raw) : raw
  }

  const output = template.replace(PLACEHOLDER, (_, rawName) => values[rawName.trim()])

  const result = checkHtml(output, { expectH1: data.DOCUMENT_H1 })
  if (!result.ok) {
    throw new Error(`渲染结果未通过检查：\n${result.errors.map((item) => `- ${item}`).join('\n')}`)
  }

  return output
}

/**
 * 独立检查最终 HTML。
 *
 * 扫描规则不复用模板字段：只要出现 {{...}} 就按残留占位符处理，
 * 字段名含数字、拼写错误或未闭合写法都不会被漏掉。
 *
 * @param {string} html
 * @param {{ expectH1?: string }} [options]
 * @returns {{ ok: boolean, errors: string[], h1?: string }}
 */
export function checkHtml(html, { expectH1 } = {}) {
  const errors = []

  const matches = [...html.matchAll(ANY_PLACEHOLDER)]
  for (const match of matches) {
    const field = match[1].trim() || '(空字段名)'
    errors.push(`第 ${lineOf(html, match.index)} 行发现残留占位符 {{${field}}}`)
  }

  const ranges = matches.map((match) => [match.index, match.index + match[0].length])
  let cursor = html.indexOf('{{')
  while (cursor !== -1) {
    if (!ranges.some(([start, end]) => cursor >= start && cursor < end)) {
      errors.push(`第 ${lineOf(html, cursor)} 行发现未闭合的 "{{"`)
    }
    cursor = html.indexOf('{{', cursor + 2)
  }

  const h1Match = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)
  let h1
  if (!h1Match) {
    errors.push('未找到正文 <h1>')
  } else {
    h1 = htmlToText(h1Match[1])
    if (h1 === '') {
      errors.push('正文 <h1> 为空')
    } else if (h1.includes('{{')) {
      errors.push(`正文 <h1> 含残留占位符：${h1}`)
    } else if (expectH1 !== undefined && normalize(h1) !== normalize(expectH1)) {
      errors.push(`正文 <h1> 与期望不一致：实际 "${h1}"，期望 "${String(expectH1)}"`)
    }
  }

  return { ok: errors.length === 0, errors, ...(h1 === undefined ? {} : { h1 }) }
}

/* ────────────────────────── 工具函数 ────────────────────────── */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function htmlToText(fragment) {
  return decodeEntities(fragment.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function normalize(value) {
  return String(value).replace(/\s+/g, ' ').trim()
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length
}

/* ────────────────────────── CLI ────────────────────────── */

function parseArgs(argv) {
  const args = {}
  const valueFlags = new Map([
    ['--data', 'data'],
    ['--out', 'out'],
    ['--template', 'template'],
    ['--check', 'check'],
    ['--expect-h1', 'expectH1'],
  ])

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      args.help = true
      continue
    }
    const key = valueFlags.get(arg)
    if (key === undefined) throw new Error(`未知参数：${arg}`)
    const value = argv[i + 1]
    if (value === undefined) throw new Error(`参数 ${arg} 缺少值`)
    args[key] = value
    i += 1
  }
  return args
}

function readData(file) {
  const text = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8')
  let data
  try {
    data = JSON.parse(text)
  } catch (error) {
    throw new Error(`字段 JSON 解析失败：${error.message}`)
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('字段 JSON 必须是对象')
  }
  return data
}

function printUsage() {
  console.log(`共享 HTML 蓝图渲染与检查

渲染：
  node render-blueprint.mjs --data <字段.json|-> --out <产物.html> [--template <模板.html>]

检查已有文件：
  node render-blueprint.mjs --check <产物.html> [--expect-h1 <正文标题>]

JSON 的键必须与模板中的 {{...}} 一致；渲染后自动扫描残留占位符并核对正文 <h1>。
正文需要展示占位符字面量时，写成 &#123;&#123;...&#125;&#125;，否则按残留处理。
退出码：0 = 通过，1 = 未通过。
`)
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2))
    if (args.help) {
      printUsage()
      return
    }

    if (args.check !== undefined) {
      const html = fs.readFileSync(args.check, 'utf8')
      const result = checkHtml(html, { expectH1: args.expectH1 })
      if (!result.ok) {
        console.error(`❌ ${args.check} 未通过交付检查：`)
        for (const error of result.errors) console.error(`   - ${error}`)
        process.exitCode = 1
        return
      }
      console.log(`✅ ${args.check}：无残留占位符；正文 h1 = "${result.h1}"`)
      return
    }

    if (args.data === undefined) throw new Error('渲染模式需要 --data <字段.json|->')
    if (args.out === undefined) throw new Error('渲染模式需要 --out <产物.html>')

    const { template, fields } = loadTemplate(args.template)
    const data = readData(args.data)
    const html = renderBlueprint({ template, fields, data })

    const out = path.resolve(args.out)
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, html, 'utf8')

    const result = checkHtml(html, { expectH1: data.DOCUMENT_H1 })
    if (!result.ok) throw new Error(`渲染结果未通过检查：\n${result.errors.join('\n')}`)
    console.log(`✅ 已渲染 ${out}`)
    console.log(`✅ 校验通过：无残留占位符；正文 h1 = "${result.h1}"`)
  } catch (error) {
    console.error(`❌ ${error.message}`)
    process.exitCode = 1
  }
}

const isMain = process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) main()
