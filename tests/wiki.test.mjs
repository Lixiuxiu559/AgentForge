import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtemp, realpath, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Link and anchor checking shared by every catalog wiki; catalog rules live in wiki-catalog.test.mjs.
const script = fileURLToPath(new URL('../skills/wiki/scripts/wiki.mjs', import.meta.url))

async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'agentforge-wiki-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function put(root, path, content) {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), content)
}

// Writes wiki/catalog.json, a README linking every page, and pages whose body follows the title and summary.
async function wiki(root, pages) {
  const entries = Object.entries(pages).map(([path, body], i) => ({ id: `p${i}`, title: `Page ${i}`, path, summary: `Summary ${i}.`, sources: [], body }))
  await put(root, 'wiki/catalog.json', JSON.stringify({ version: 2, title: 'Fixture', language: 'en', pathLanguage: 'en', pages: entries.map(({ body, ...page }) => page) }))
  await put(root, 'wiki/README.md', `# Fixture\n\n> Overview.\n\n${entries.map(page => `- [${page.title}](${page.path})`).join('\n')}\n`)
  for (const page of entries) await put(root, `wiki/${page.path}`, `# ${page.title}\n\n> ${page.summary}\n\n${page.body}`)
}

function run(root, ...args) {
  const result = spawnSync(process.execPath, [script, args[0], '--root', root, ...args.slice(1)], { cwd: tmpdir(), encoding: 'utf8' })
  assert.equal(result.signal, null, result.stderr)
  let body
  try { body = JSON.parse(result.stdout) } catch {
    assert.fail(`Expected JSON, exit=${result.status}: ${result.stdout}\n${result.stderr}`)
  }
  assert.ok(['passed', 'issues', 'partial', 'error'].includes(body.status))
  assert.equal(body.coverage.semantic, 'not_run')
  assert.equal(result.status, body.status === 'passed' ? 0 : body.status === 'error' ? 2 : 1)
  return body
}
const check = root => run(root, 'check', '--wiki', 'wiki')

test('a small wiki passes from an unrelated cwd and is left unchanged', async t => {
  const root = await fixture(t)
  await wiki(root, { 'start.md': 'A small CLI.\n' })
  const before = await readFile(join(root, 'wiki/start.md'), 'utf8')
  assert.equal(check(root).status, 'passed')
  assert.equal(await readFile(join(root, 'wiki/start.md'), 'utf8'), before)
})

test('missing wiki directories and missing catalogs fail as errors', async t => {
  const root = await fixture(t)
  assert.equal(check(root).status, 'error')
  await put(root, 'wiki/start.md', '# Start\n')
  const result = check(root)
  assert.equal(result.status, 'error')
  assert.match(result.findings[0].message, /catalog\.json not found/)
})

test('legacy commands, unknown options and relative roots are rejected', async t => {
  const root = await fixture(t)
  await wiki(root, { 'start.md': 'Text.\n' })
  for (const command of ['changes', 'mapping', 'freshness', 'review', 'gate']) assert.equal(run(root, command).status, 'error')
  assert.equal(run(root, 'check', '--wiki', 'wiki', '--config', 'wiki.config.json').status, 'error')
  assert.equal(run(basename(root), 'check', '--wiki', 'wiki').status, 'error')
})

test('relative targets and Chinese anchors resolve; fenced examples are not links', async t => {
  const root = await fixture(t)
  await put(root, 'docs/guide.md', '# 使用说明\n\n## 配置\n')
  await wiki(root, { 'start.md': '[指南](../docs/guide.md#配置)\n\n```md\n[example](./missing.md)\n```\n' })
  assert.equal(check(root).status, 'passed')
  await wiki(root, { 'start.md': '[指南](../docs/guide.md#不存在)\n' })
  assert.deepEqual(check(root).findings.map(item => item.code), ['missing-anchor'])
  await wiki(root, { 'start.md': '[缺失](../docs/absent.md)\n' })
  assert.deepEqual(check(root).findings.map(item => item.code), ['broken-link'])
})

test('reference-style links and repeated heading anchors are checked', async t => {
  const root = await fixture(t)
  await wiki(root, { 'guide.md': '## Repeat\n\n## Repeat\n', 'start.md': '[guide][target]\n\n[target]: ./guide.md#repeat-1\n' })
  assert.equal(check(root).status, 'passed')
  await wiki(root, { 'guide.md': '## Repeat\n\n## Repeat\n', 'start.md': '[guide][target]\n\n[target]: ./guide.md#repeat-2\n' })
  assert.equal(check(root).status, 'issues')
  const undefinedRef = await fixture(t)
  await wiki(undefinedRef, { 'start.md': '[guide][undefined]\n' })
  assert.deepEqual(check(undefinedRef).findings.map(item => item.code), ['missing-reference'])
})

test('nested list links and complex syntax are reported as partial, not passed', async t => {
  const root = await fixture(t)
  await wiki(root, { 'start.md': '- Parent\n    - [Missing](absent.md)\n' })
  assert.equal(check(root).status, 'partial')
  await wiki(root, { 'start.md': '[complex](./guide(with-parens).md)\n' })
  assert.equal(check(root).status, 'partial')
  await wiki(root, { 'start.md': '[example](#not-a-heading)\n\n```html\n<a id="not-a-heading"></a>\n```\n' })
  assert.deepEqual(check(root).findings.map(item => item.code), ['missing-anchor'])
})

test('links and symlinks outside the requested root are never treated as checked', async t => {
  const root = await fixture(t)
  const outside = await fixture(t)
  await put(outside, 'private.md', '# SECRET\n[broken](missing.md)\n')
  await wiki(root, { 'start.md': '[external](./escape.md#secret)\n' })
  await symlink(join(outside, 'private.md'), join(root, 'wiki/escape.md'))
  const result = check(root)
  assert.notEqual(result.status, 'passed')
  assert.ok(!JSON.stringify(result).includes('SECRET'))
  assert.ok(!JSON.stringify(result).includes('missing.md'))
})
