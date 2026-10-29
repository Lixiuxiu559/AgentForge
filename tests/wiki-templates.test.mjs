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

async function rulesFixture(t) {
  const root = await fixture(t)
  await put(root, 'wiki/README.md', await template('index-modular', {
    links_to_concepts_and_modules: '[概念](concepts.md)\n\n[模块](modules/orders/README.md)',
  }))
  await put(root, 'wiki/concepts.md', await template('concepts'))
  await put(root, 'wiki/modules/orders/README.md', await template('module', {
    links_to_related_knowledge: '[规则](rules.md)',
  }))
  await profile(root, { preset: 'modular' })
  return root
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

test('new rule pages explain current code rules and conditions without a product approval section', async t => {
  const root = await rulesFixture(t)
  const rules = await template('rules', {
    actual_rules_state_transitions_validation_and_errors_with_key_code_sources: 'createOrder caches request results in this process; src/orders.ts is the implementation source.',
    entrypoints_configuration_overrides_platform_limits_and_change_impacts: 'Restart loses the cache. Multi-process deduplication is not implemented.',
    key_source_files_symbols_actual_inspection_scope_and_tests_run_or_not_run: 'Read the current caller and cache implementation; no runtime test executed.',
    technical_unknowns_affecting_development_or_current_operations_after_investigation_or_explicit_none: 'None.',
  })
  await put(root, 'wiki/modules/orders/rules.md', rules)
  let result = run(root)
  assert.equal(result.status, 'passed')
  assert.deepEqual(result.coverage.structure.legacyDocuments, [])
  await put(root, 'wiki/modules/orders/rules.md', rules.replace('## 条件与边界', '### 条件与边界'))
  assert.equal(run(root).status, 'issues')
  await put(root, 'wiki/modules/orders/rules.md', replaceSection(rules, '条件与边界', ''))
  assert.equal(run(root).status, 'issues')
  await put(root, 'wiki/modules/orders/rules.md', rules.replace('## 条件与边界', '```md\n## 条件与边界\n```\n\n### 示例'))
  assert.equal(run(root).status, 'issues')
})

test('complete legacy rules are reported without forcing migration or claiming semantic verification', async t => {
  const root = await rulesFixture(t)
  const rules = await template('rules')
  const legacy = rules.replace('## 当前实现规则', '## 已确认规则')
    .replace('## 条件与边界', '## 实现观察与差异')
  await put(root, 'wiki/modules/orders/rules.md', legacy)
  const result = run(root)
  assert.equal(result.status, 'passed')
  assert.deepEqual(result.coverage.structure.legacyDocuments, ['wiki/modules/orders/rules.md'])
  assert.equal(result.coverage.semantic, 'not_run')
  assert.equal(await readFile(join(root, 'wiki/modules/orders/rules.md'), 'utf8'), legacy)
  // One old title plus a new implementation title is not the complete legacy layout.
  await put(root, 'wiki/modules/orders/rules.md', legacy.replace('## 实现观察与差异', '## 实现观察'))
  assert.equal(run(root).status, 'issues')
})

test('project rule conventions remain explicit and unfilled new rule templates fail', async t => {
  const root = await rulesFixture(t)
  await put(root, 'wiki/modules/orders/rules.md', await readFile(join(skill, 'assets/templates/rules.md'), 'utf8'))
  assert.equal(run(root).status, 'issues')
  const legacy = '# Existing rules\n\n## 已确认规则\n\n项目约定保持原样。\n\n## 实现观察与差异\n\n来源不足的内容保留待确认。\n'
  await put(root, 'wiki/modules/orders/rules.md', legacy)
  await profile(root, { preset: 'project', documents: [{
    path: 'wiki/modules/orders/rules.md', requiredSections: ['已确认规则', '实现观察与差异'],
  }] })
  const result = run(root)
  assert.equal(result.status, 'passed')
  assert.deepEqual(result.coverage.structure.legacyDocuments, [])
})

test('system knowledge templates are opt-in, navigable and require their specific content', async t => {
  const root = await fixture(t)
  const types = ['architecture', 'deployment', 'environments', 'operations', 'troubleshooting']
  const spec = JSON.parse(await readFile(join(skill, 'assets/schema.json'), 'utf8'))
  const documents = types.map(type => ({ path: `wiki/custom/${type}.md`, type }))
  await put(root, 'wiki/README.md', await template('index-small', {
    reading_navigation: types.map(type => `[${type}](custom/${type}.md)`).join('\n\n'),
  }))
  for (const type of types) await put(root, `wiki/custom/${type}.md`, await template(type))
  await profile(root, { preset: 'small', documents })
  assert.equal(run(root).status, 'passed')
  for (const type of types) {
    const path = `wiki/custom/${type}.md`, original = await template(type)
    await put(root, path, replaceSection(original, spec.types[type].sections[0], ''))
    assert.ok(run(root).findings.some(f => f.code === 'empty-section' && f.path === path))
    await put(root, path, await readFile(join(skill, `assets/templates/${type}.md`), 'utf8'))
    assert.ok(run(root).findings.some(f => f.code === 'unresolved-placeholder' && f.path === path))
    await put(root, path, original)
  }
})

test('environment observations require provenance fields but accept explicit unknown runtime state', async t => {
  const root = await fixture(t)
  const original = await template('environments', {
    environments_in_scope: '用户宿主；未访问生产环境',
    actual_observation_time_or_not_observed: '未执行运行状态观测',
    runtime_evidence_reference_or_explicit_unknown: '未知：只有仓库声明配置，没有运行证据',
  })
  await put(root, 'wiki/state.md', original)
  await profile(root, { preset: 'project', documents: [{ path: 'wiki/state.md', type: 'environments' }] })
  assert.equal(run(root).status, 'passed')
  for (const field of ['适用环境', '观察时间', '证据来源']) {
    await put(root, 'wiki/state.md', original.split('\n').filter(line => !line.startsWith(`| ${field} |`)).join('\n'))
    const result = run(root)
    assert.ok(result.findings.some(f => f.code === 'missing-document-field' && f.message.includes(field)))
  }
  await put(root, 'wiki/state.md', original)
  assert.equal(run(root).status, 'passed')
  assert.equal(await readFile(join(root, 'wiki/state.md'), 'utf8'), original)
})

test('project conventions coexist with an explicitly typed document outside the Wiki directory', async t => {
  const root = await fixture(t)
  const custom = '# Existing architecture\n\n## Components\n\nManual content stays.\n'
  await put(root, 'wiki/architecture/README.md', custom)
  await put(root, 'handbook/install.md', await template('deployment'))
  await profile(root, { preset: 'project', documents: [
    { path: 'wiki/architecture/README.md', requiredSections: ['Components'] },
    { path: 'handbook/install.md', type: 'deployment', requiredSections: ['Local detail'] },
  ] })
  let result = run(root)
  assert.equal(result.status, 'issues')
  assert.deepEqual(result.findings.map(f => [f.code, f.path]), [['missing-section', 'handbook/install.md']])
  await put(root, 'handbook/install.md', (await template('deployment')) + '\n## Local detail\n\nExplicit project rule.\n')
  assert.equal(run(root).status, 'passed')
  assert.equal(await readFile(join(root, 'wiki/architecture/README.md'), 'utf8'), custom)
})

test('new knowledge directories are not mandatory and document types reject typos', async t => {
  const root = await fixture(t)
  await put(root, 'wiki/README.md', await template('index-small'))
  await profile(root, { preset: 'small' })
  assert.equal(run(root).status, 'passed')
  for (const type of ['environment', '', 42, null]) {
    await profile(root, { preset: 'project', documents: [{ path: 'wiki/README.md', type }] })
    assert.equal(run(root).status, 'error')
  }
  await profile(root, { preset: 'project', documents: [{ path: 'wiki/not-created.md', type: 'architecture' }] })
  assert.ok(run(root).findings.some(f => f.code === 'missing-structure-document'))
})

test('default Wiki can require existing external architecture without imposing default metadata', async t => {
  const root = await fixture(t)
  await put(root, 'wiki/README.md', await template('index-small', { reading_navigation: '[Architecture](../docs/design.md)' }))
  const existing = '# Design\n\n## Components\n\nExisting components.\n'
  await put(root, 'docs/design.md', existing)
  await profile(root, { preset: 'small', documents: [{ path: 'docs/design.md', requiredSections: ['Components'] }] })
  assert.equal(run(root).status, 'passed')
  await put(root, 'docs/design.md', '# Design\n')
  assert.deepEqual(run(root).findings.map(f => f.code), ['missing-section'])
  await put(root, 'docs/design.md', existing)
  assert.equal(await readFile(join(root, 'docs/design.md'), 'utf8'), existing)
})


test('previous three-section rule pages stay compatible without rewriting existing project content', async t => {
  const root = await rulesFixture(t)
  const original = (await template('rules'))
    .replace('## 当前实现规则', '## 预期与约定')
    .replace('## 条件与边界', '## 实现观察')
    .replace('## 依据与核验', '## 运行验证\n\n历史验证范围保持原样。\n\n## 依据与核验')
  await put(root, 'wiki/modules/orders/rules.md', original)
  const result = run(root)
  assert.equal(result.status, 'passed')
  assert.deepEqual(result.coverage.structure.legacyDocuments, ['wiki/modules/orders/rules.md'])
  assert.equal(await readFile(join(root, 'wiki/modules/orders/rules.md'), 'utf8'), original)
})

test('modular Wiki supports project-language names through explicit document types', async t => {
  const root = await fixture(t)
  const concepts = await template('concepts')
  await put(root, 'wiki/README.md', await template('index-modular', {
    links_to_concepts_and_modules: '[概念](核心概念.md)\n\n[订单](modules/订单/README.md)\n\n[架构](系统架构/README.md)',
  }))
  await put(root, 'wiki/核心概念.md', concepts)
  await put(root, 'wiki/系统架构/README.md', await template('architecture'))
  await put(root, 'wiki/modules/订单/README.md', await template('module', {
    links_to_related_knowledge: '[规则](规则.md)\n\n[映射](实现映射.md)\n\n[依赖](依赖关系.md)',
  }))
  const documents = [
    { path: 'wiki/核心概念.md', type: 'concepts' },
    { path: 'wiki/系统架构/README.md', type: 'architecture' },
    ...[['规则', 'rules'], ['实现映射', 'code-map'], ['依赖关系', 'dependencies']].map(([name, type]) => ({ path: `wiki/modules/订单/${name}.md`, type })),
  ]
  for (const doc of documents.slice(2)) await put(root, doc.path, await template(doc.type))
  await profile(root, { preset: 'modular', documents })
  assert.equal(run(root).status, 'passed')
  assert.equal(await readFile(join(root, 'wiki/核心概念.md'), 'utf8'), concepts)
  const rules = documents.find(doc => doc.type === 'rules')
  await put(root, rules.path, replaceSection(await template('rules'), '条件与边界', ''))
  assert.ok(run(root).findings.some(f => f.path === rules.path && f.code === 'empty-section'))
})

test('declared concepts naming preserves missing-file and content checks and English defaults', async t => {
  const root = await fixture(t)
  await put(root, 'wiki/README.md', await template('index-modular', {
    links_to_concepts_and_modules: '[模块](modules/runtime/README.md)',
  }))
  await put(root, 'wiki/modules/runtime/README.md', await template('module'))
  await profile(root, { preset: 'modular', documents: [{ path: 'wiki/Concepts.md', type: 'concepts' }] })
  let result = run(root)
  assert.ok(result.findings.some(f => f.code === 'missing-structure-document' && f.path === 'wiki/Concepts.md'))
  assert.ok(!result.findings.some(f => f.path === 'wiki/concepts.md'))
  await put(root, 'wiki/Concepts.md', replaceSection(await template('concepts'), '术语与概念', ''))
  assert.ok(run(root).findings.some(f => f.code === 'empty-section' && f.path === 'wiki/Concepts.md'))
  await rm(join(root, 'wiki/Concepts.md'))
  await profile(root, { preset: 'modular' })
  result = run(root)
  assert.ok(result.findings.some(f => f.code === 'missing-structure-document' && f.path === 'wiki/concepts.md'))
})
