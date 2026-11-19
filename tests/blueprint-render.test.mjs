import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { checkHtml, loadTemplate, renderBlueprint } from '../skills/_shared/scripts/render-blueprint.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const SCRIPT = join(ROOT, 'skills/_shared/scripts/render-blueprint.mjs')

function fixtureData(fields, overrides = {}) {
  const data = {}
  for (const name of fields) data[name] = `示例 ${name}`
  return {
    ...data,
    DOCUMENT_LANG: 'zh-CN',
    DOCUMENT_TITLE: '测试 & 文档',
    DOCUMENT_TYPE: 'test',
    DOC_BRAND_MARK: 'AF',
    DOC_BRAND: 'AgentForge',
    DOC_KIND_LABEL: 'TEST',
    NAV_ITEMS: '<a href="#s1"><span>01</span>章节</a>',
    SIDEBAR_META: '共 1 节',
    HERO_EYEBROW: 'TEST',
    DOCUMENT_H1: '正文 <标题> & 说明',
    DOCUMENT_SUBTITLE: '副标题',
    DOC_BADGES: '<span class="badge">读者</span>',
    SUMMARY_BLOCK: '<div class="summary-strip"></div>',
    LEAD_NOTICE: '',
    DOCUMENT_SECTIONS: '<section class="doc-section" id="s1"><h2>章节</h2></section>',
    FOOTER_CONTENT: '<span>页脚</span>',
    ...overrides,
  }
}

test('template exposes the digit-bearing body title field', () => {
  const { fields } = loadTemplate()
  assert.ok(fields.includes('DOCUMENT_H1'))
  assert.equal(new Set(fields).size, fields.length)
})

test('renders the real blueprint, escapes text fields and verifies the body h1', () => {
  const { template, fields } = loadTemplate()
  const html = renderBlueprint({ template, fields, data: fixtureData(fields) })

  assert.doesNotMatch(html, /\{\{/)
  assert.match(html, /<title>测试 &amp; 文档<\/title>/)
  assert.match(html, /<h1>正文 &lt;标题&gt; &amp; 说明<\/h1>/)

  const result = checkHtml(html, { expectH1: '正文 <标题> & 说明' })
  assert.equal(result.ok, true, result.errors.join('\n'))
  assert.equal(result.h1, '正文 <标题> & 说明')
})

test('rejects a missing title field and an unknown field', () => {
  const { template, fields } = loadTemplate()

  const missing = fixtureData(fields)
  delete missing.DOCUMENT_H1
  assert.throws(
    () => renderBlueprint({ template, fields, data: missing }),
    /DOCUMENT_H1/,
  )

  assert.throws(
    () => renderBlueprint({ template, fields, data: { ...fixtureData(fields), EXTRA_FIELD: 'x' } }),
    /EXTRA_FIELD/,
  )
})

test('check reports leftover placeholders with field names and line numbers', () => {
  const html = '<html>\n<body>\n<h1>标题</h1>\n<p>{{LEFTOVER_1}}</p>\n</body>\n</html>'
  const result = checkHtml(html, { expectH1: '标题' })

  assert.equal(result.ok, false)
  const message = result.errors.join('\n')
  assert.match(message, /LEFTOVER_1/)
  assert.match(message, /第 4 行/)
})

test('check catches an unclosed placeholder and an h1 mismatch', () => {
  const unclosed = checkHtml('<h1>标题</h1>\n{{UNCLOSED', { expectH1: '标题' })
  assert.equal(unclosed.ok, false)
  assert.match(unclosed.errors.join('\n'), /未闭合/)

  const mismatched = checkHtml('<h1>实际标题</h1>', { expectH1: '期望标题' })
  assert.equal(mismatched.ok, false)
  assert.match(mismatched.errors.join('\n'), /不一致/)
})

test('check keeps a literal escaped ampersand distinct from an entity', () => {
  const result = checkHtml('<h1>标题 &amp;lt; 字面量</h1>', { expectH1: '标题 &lt; 字面量' })
  assert.equal(result.ok, true, result.errors.join('\n'))
})

test('CLI renders, checks and rejects a missing field', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'agentforge-blueprint-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const { fields } = loadTemplate()
  const dataPath = join(dir, 'data.json')
  const outPath = join(dir, 'out.html')
  await writeFile(dataPath, JSON.stringify(fixtureData(fields), null, 2))

  const rendered = execFileSync(
    process.execPath,
    [SCRIPT, '--data', dataPath, '--out', outPath],
    { encoding: 'utf8' },
  )
  assert.match(rendered, /已渲染/)
  const html = await readFile(outPath, 'utf8')
  assert.doesNotMatch(html, /\{\{/)

  const checked = execFileSync(
    process.execPath,
    [SCRIPT, '--check', outPath, '--expect-h1', '正文 <标题> & 说明'],
    { encoding: 'utf8' },
  )
  assert.match(checked, /无残留占位符/)

  const missing = fixtureData(fields)
  delete missing.DOCUMENT_H1
  const missingPath = join(dir, 'missing.json')
  await writeFile(missingPath, JSON.stringify(missing, null, 2))
  const failed = spawnSync(
    process.execPath,
    [SCRIPT, '--data', missingPath, '--out', join(dir, 'missing.html')],
    { encoding: 'utf8' },
  )
  assert.equal(failed.status, 1)
  assert.match(`${failed.stdout}${failed.stderr}`, /DOCUMENT_H1/)

  const badPath = join(dir, 'bad.html')
  await writeFile(badPath, '<h1>标题</h1>\n{{BAD_1}}')
  const bad = spawnSync(
    process.execPath,
    [SCRIPT, '--check', badPath, '--expect-h1', '标题'],
    { encoding: 'utf8' },
  )
  assert.equal(bad.status, 1)
  assert.match(`${bad.stdout}${bad.stderr}`, /BAD_1/)
})
