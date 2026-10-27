import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const skill = fileURLToPath(new URL('../skills/wiki/', import.meta.url))
const script = join(skill, 'scripts/wiki.mjs')

async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'agentforge-wiki-templates-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function put(root, path, content) {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), content)
}

async function template(type, replacements = {}) {
  const text = await readFile(join(skill, 'assets/templates', `${type}.md`), 'utf8')
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => replacements[key] ?? '待确认：当前材料尚未提供证据')
}

async function profile(root, structure) {
  await put(root, 'wiki.config.json', JSON.stringify({ version: 1, modules: [], ...(structure ? { structure } : {}) }))
}

function run(root, entrypoint = script) {
  const result = spawnSync(process.execPath, [entrypoint, 'check', '--root', root, '--wiki', 'wiki', '--config', 'wiki.config.json'], {
    cwd: tmpdir(), encoding: 'utf8',
  })
  assert.equal(result.error, undefined)
  assert.equal(result.signal, null, result.stderr)
  const body = JSON.parse(result.stdout)
  assert.equal(result.status, body.status === 'passed' ? 0 : body.status === 'error' ? 2 : 1, result.stdout)
  assert.equal(body.coverage.semantic, 'not_run')
  assert.ok(Array.isArray(body.findings))
  return body
}

function replaceSection(text, heading, content) {
  const start = text.indexOf(`## ${heading}\n`)
  assert.notEqual(start, -1, heading)
  const end = text.indexOf('\n## ', start + 4)
  return text.slice(0, start) + `## ${heading}\n\n${content}\n` + (end < 0 ? '' : text.slice(end))
}

test('small default uses its actual template as a single draft with explicit unknowns', async t => {
  const root = await fixture(t)
  const text = await template('index-small')
  await put(root, 'wiki/README.md', text)
  await profile(root, { preset: 'small' })
  const result = run(root)
  assert.equal(result.status, 'passed', JSON.stringify(result))
  assert.equal(await readFile(join(root, 'wiki/README.md'), 'utf8'), text)
})

test('modular templates provide all document types and transitive navigation', async t => {
  const root = await fixture(t)
  const index = await template('index-modular', {
    links_to_concepts_and_modules: '[概念](concepts.md)\n\n[订单](modules/orders/README.md)',
  })
  const module = await template('module', {
    links_to_related_knowledge: '[规则](rules.md)\n\n[代码](code-map.md)\n\n[依赖](dependencies.md)\n\n[补充](../../extra.md)',
  })
  await put(root, 'wiki/README.md', index)
  await put(root, 'wiki/concepts.md', await template('concepts'))
  await put(root, 'wiki/modules/orders/README.md', module)
  for (const type of ['rules', 'code-map', 'dependencies']) await put(root, `wiki/modules/orders/${type}.md`, await template(type))
  await put(root, 'wiki/extra.md', await template('guide'))
  await profile(root, { preset: 'modular' })
  assert.equal(run(root).status, 'passed')
})

test('modular default permits combined modules without forcing all split files', async t => {
  const root = await fixture(t)
  await put(root, 'wiki/README.md', await template('index-modular', {
    links_to_concepts_and_modules: '[概念](concepts.md)\n\n[模块](modules/cli/README.md)',
  }))
  await put(root, 'wiki/concepts.md', await template('concepts'))
  await put(root, 'wiki/modules/cli/README.md', await template('module'))
  await profile(root, { preset: 'modular' })
  assert.equal(run(root).status, 'passed')
})

test('required default files and module overviews cannot be omitted', async t => {
  const root = await fixture(t)
  await put(root, 'wiki/other.md', await template('guide'))
  await profile(root, { preset: 'small' })
  assert.equal(run(root).status, 'issues')
  await put(root, 'wiki/README.md', await template('index-modular'))
  await profile(root, { preset: 'modular' })
  assert.equal(run(root).status, 'issues')
  await put(root, 'wiki/concepts.md', await template('concepts'))
  await put(root, 'wiki/modules/no-overview/rules.md', await template('rules'))
  assert.equal(run(root).status, 'issues')
})

test('unfilled templates, empty sections and headings inside code fences fail default checks', async t => {
  const root = await fixture(t)
  const original = await template('index-small')
  await profile(root, { preset: 'small' })
  const raw = await readFile(join(skill, 'assets/templates/index-small.md'), 'utf8')
  await put(root, 'wiki/README.md', raw)
  assert.equal(run(root).status, 'issues')
  await put(root, 'wiki/README.md', replaceSection(original, '依据与核验', ''))
  assert.equal(run(root).status, 'issues')
  const fake = original.replace('## 规则与实现', '```md\n## 规则与实现\nexample\n```\n\n### 非必需章节')
  await put(root, 'wiki/README.md', fake)
  assert.equal(run(root).status, 'issues')
})

test('metadata checks missing values, state and actual calendar dates without inventing verification', async t => {
  const root = await fixture(t)
  const original = await template('index-small')
  await profile(root, { preset: 'small' })
  const invalid = [
    original.replace(/\| 适用范围 \|[^\n]+\n/, ''),
    original.replace(/\| 核验基线 \|[^\n]+\n/, '| 核验基线 | |\n'),
    original.replace('| 事实状态 | 草稿 |', '| 事实状态 | 完美 |'),
    original.replace('| 事实状态 | 草稿 |', '| 事实状态 | 已核验 |'),
    original.replace('| 核验时间 | 未核验 |', '| 核验时间 | 2026-02-29 |'),
  ]
  for (const text of invalid) {
    await put(root, 'wiki/README.md', text)
    assert.equal(run(root).status, 'issues')
  }
  await put(root, 'wiki/README.md', original.replace('| 核验时间 | 未核验 |', '| 核验时间 | 2024-02-29 |'))
  assert.equal(run(root).status, 'passed')
})

test('default entry navigation catches valid but unreachable knowledge pages', async t => {
  const root = await fixture(t)
  let index = await template('index-small')
  await put(root, 'wiki/README.md', index)
  await put(root, 'wiki/hidden.md', await template('guide'))
  await profile(root, { preset: 'small' })
  assert.equal(run(root).status, 'issues')
  index = replaceSection(index, '阅读导航', '[更多](hidden.md)')
  await put(root, 'wiki/README.md', index)
  assert.equal(run(root).status, 'passed')
})

test('legacy projects retain their conventions with absent or explicit project preset', async t => {
  const root = await fixture(t)
  const content = '# Existing handbook\n\nExisting English prose and manual annotations.\n'
  await put(root, 'wiki/handbook.md', content)
  await profile(root)
  assert.equal(run(root).status, 'passed')
  await profile(root, { preset: 'project' })
  assert.equal(run(root).status, 'passed')
  assert.equal(await readFile(join(root, 'wiki/handbook.md'), 'utf8'), content)
})

test('project-required documents and sections use project names without default metadata', async t => {
  const root = await fixture(t)
  await put(root, 'wiki/handbook.md', '# Handbook\n\n## Scope\n\nCLI arguments.\n\n## References\n\nUser-confirmed contract.\n')
  await profile(root, { preset: 'project', documents: [{ path: 'wiki/handbook.md', requiredSections: ['Scope', 'References'] }] })
  assert.equal(run(root).status, 'passed')
  await put(root, 'wiki/handbook.md', '# Handbook\n\n## Scope\n\nCLI arguments.\n')
  assert.equal(run(root).status, 'issues')
  await profile(root, { preset: 'project', documents: [{ path: 'wiki/missing.md' }] })
  assert.equal(run(root).status, 'issues')
})

test('project entry outside the wiki may navigate into existing knowledge', async t => {
  const root = await fixture(t)
  await put(root, 'handbook/index.md', '# Index\n\n[Usage](../wiki/usage.md)\n')
  await put(root, 'wiki/usage.md', '# Usage\n\nActual CLI help.\n')
  await profile(root, { preset: 'project', entry: 'handbook/index.md' })
  assert.equal(run(root).status, 'passed')
  await put(root, 'handbook/index.md', '# Index\n\nNo navigation.\n')
  assert.equal(run(root).status, 'issues')
})

test('invalid structure configuration and escaped required files fail closed', async t => {
  const root = await fixture(t)
  await put(root, 'wiki/README.md', '# Existing\n')
  const invalid = [
    { preset: 'unknown' },
    { preset: 'project', typo: [] },
    { preset: 'project', documents: [{ path: '../escaped.md' }] },
    { preset: 'project', documents: [{ path: 'wiki/README.md', requiredSections: [''] }] },
    { preset: 'project', documents: [{ path: 'wiki/README.md' }, { path: 'wiki/README.md' }] },
  ]
  for (const structure of invalid) {
    await profile(root, structure)
    assert.equal(run(root).status, 'error')
  }
  const outside = await fixture(t)
  await put(outside, 'private.md', '# PRIVATE-SOURCE-MARKER\n')
  await symlink(join(outside, 'private.md'), join(root, 'escaped.md'))
  await profile(root, { preset: 'project', documents: [{ path: 'escaped.md' }] })
  const body = run(root)
  assert.equal(body.status, 'error')
  assert.ok(!JSON.stringify(body).includes('PRIVATE-SOURCE-MARKER'))
})

test('relocated packaged scripts load their own schema and keep target files unchanged', async t => {
  const root = await fixture(t)
  const install = await fixture(t)
  await cp(join(skill, 'scripts'), join(install, 'scripts'), { recursive: true })
  await cp(join(skill, 'assets'), join(install, 'assets'), { recursive: true })
  const content = await template('index-small')
  await put(root, 'wiki/README.md', content)
  await profile(root, { preset: 'small' })
  assert.equal(run(root, join(install, 'scripts/wiki.mjs')).status, 'passed')
  assert.equal(await readFile(join(root, 'wiki/README.md'), 'utf8'), content)
})

test('an empty required section cannot borrow content from a following H1 appendix', async t => {
  const root = await fixture(t)
  await put(root, 'wiki/handbook.md', '# Handbook\n\n## Required\n\n# Appendix\n\nUnrelated appendix prose.\n')
  await profile(root, { preset: 'project', documents: [{ path: 'wiki/handbook.md', requiredSections: ['Required'] }] })
  assert.equal(run(root).status, 'issues')
})

test('template placeholders in actual metadata fail while literal code examples remain allowed', async t => {
  const root = await fixture(t)
  const original = await template('index-small')
  await profile(root, { preset: 'small' })
  await put(root, 'wiki/README.md', original.replace(/\| 核验基线 \|[^\n]+\n/, '| 核验基线 | `{{baseline}}` |\n'))
  assert.equal(run(root).status, 'issues')
  await put(root, 'wiki/README.md', replaceSection(original, '代码与依赖', '模板示例：`{{name}}`。\n\n```text\n{{example}}\n```'))
  assert.equal(run(root).status, 'passed')
})

test('image destinations never count as navigation links, including reference-style images', async t => {
  const root = await fixture(t)
  const original = await template('index-small')
  await put(root, 'wiki/hidden.md', await template('guide'))
  await profile(root, { preset: 'small' })
  for (const image of ['![页面](hidden.md)', '![页面][target]\n\n[target]: hidden.md', '![target]\n\n[target]: hidden.md']) {
    await put(root, 'wiki/README.md', replaceSection(original, '阅读导航', image))
    assert.equal(run(root).status, 'issues')
  }
  await put(root, 'wiki/README.md', replaceSection(original, '阅读导航', '[页面](hidden.md)'))
  assert.equal(run(root).status, 'passed')
})
