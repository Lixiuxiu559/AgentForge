import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtemp, realpath, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../skills/wiki/scripts/wiki.mjs', import.meta.url))
const zh = '订单模块负责下单、支付回调和状态流转，不负责库存扣减，库存由独立服务处理并通过消息通知。'.repeat(8)
const en = 'The order module creates orders, handles payment callbacks and moves states forward through the lifecycle. '.repeat(20)

async function project(t, files) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'agentforge-catalog-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const [path, body] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), typeof body === 'string' ? body : JSON.stringify(body))
  }
  return root
}
function check(root) {
  const run = spawnSync(process.execPath, [script, 'check', '--root', root], { encoding: 'utf8' })
  return { code: run.status, data: JSON.parse(run.stdout) }
}
const codes = data => data.findings.map(item => item.code).sort()
const catalog = (pages, extra = {}) => ({ version: 2, title: '订单服务', language: 'zh-CN', pathLanguage: 'zh-CN', pages, ...extra })
const page = { id: 'order', title: '订单模块', path: '核心模块/订单.md', summary: '负责下单与支付回调。', sources: ['src/order.ts'] }
const base = {
  'src/order.ts': 'export {}\n',
  'docs/wiki/README.md': `# 订单服务\n\n> 项目概览。\n\n- [订单模块](核心模块/订单.md)\n`,
  'docs/wiki/核心模块/订单.md': `# 订单模块\n\n> 负责下单与支付回调。\n\n${zh}\n\n见 [OrderService](../../../src/order.ts#L1)。\n`,
}

test('a consistent catalog passes with Chinese paths and the default wiki directory', async t => {
  const root = await project(t, { ...base, 'docs/wiki/catalog.json': catalog([page]) })
  const { code, data } = check(root)
  assert.equal(code, 0, JSON.stringify(data.findings))
  assert.equal(data.language, 'zh-CN')
  assert.deepEqual(data.coverage.catalog, { pages: 1, planned: 0, oversized: [] })
  // Source links with line numbers are the recommended style and must not degrade the run.
  assert.equal(data.coverage.nonMarkdownAnchors, 1)
  assert.deepEqual(data.coverage.limitations, [])
})

test('pages backed by more than 15 source files are listed as advisory, except README', async t => {
  const many = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`src/order/f${i}.ts`, 'export {}\n']))
  const overview = { id: 'overview', title: '订单服务', path: 'README.md', summary: '项目概览。', sources: ['src'] }
  const root = await project(t, { ...base, ...many, 'docs/wiki/catalog.json': catalog([overview, { ...page, sources: ['src/order', 'src/order.ts'] }]) })
  const { code, data } = check(root)
  assert.equal(code, 0, JSON.stringify(data.findings))
  assert.deepEqual(data.coverage.catalog.oversized, [{ id: 'order', path: 'docs/wiki/核心模块/订单.md', sourceFiles: 17 }])
})

test('catalog check reports missing sources, summary drift, language drift and orphan pages', async t => {
  const root = await project(t, {
    ...base,
    'docs/wiki/catalog.json': catalog([{ ...page, sources: ['src/missing.ts'] }, { id: 'pay', title: '支付', path: '核心模块/支付.md', summary: '支付渠道。', sources: [] }]),
    'docs/wiki/核心模块/订单.md': `# Order module\n\n> Creates orders.\n\n${en}\n`,
    'docs/wiki/核心模块/支付.md': `# 支付\n\n> 支付渠道。\n\n${zh}\n`,
    'docs/wiki/notes.md': '# 杂记\n',
  })
  const { code, data } = check(root)
  assert.equal(code, 1)
  assert.deepEqual(codes(data), ['language-mismatch', 'missing-source', 'summary-mismatch', 'uncatalogued-page', 'unreachable-page'])
})

test('planned pages may be absent, but missing pages and a missing title or summary are reported', async t => {
  const planned = await project(t, { ...base, 'docs/wiki/catalog.json': catalog([page, { ...page, id: 'later', path: '关键流程/发布.md', status: 'planned' }]) })
  assert.equal(check(planned).code, 0)
  const broken = await project(t, {
    ...base,
    'docs/wiki/catalog.json': catalog([page, { ...page, id: 'gone', path: '核心模块/缺失.md' }]),
    'docs/wiki/核心模块/订单.md': `${zh}\n`,
  })
  assert.deepEqual(codes(check(broken).data), ['missing-page', 'missing-summary', 'missing-title'])
})

test('invalid catalogs fail as execution errors', async t => {
  for (const bad of [
    catalog([page], { version: 1 }),
    catalog([{ ...page, path: '../../escape.md' }]),
    catalog([page, { ...page }]),
    catalog([{ ...page, children: ['nowhere.md'] }]),
    catalog([{ ...page, sources: ['/etc/passwd'] }]),
    catalog([page], { extra: true }),
  ]) {
    const root = await project(t, { ...base, 'docs/wiki/catalog.json': bad })
    const { code, data } = check(root)
    assert.equal(code, 2, JSON.stringify(bad))
    assert.equal(data.status, 'error')
  }
})
