import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, realpath, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../skills/wiki/scripts/wiki.mjs', import.meta.url))
const gitEnv = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete gitEnv[key]

async function repo(t, files) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'agentforge-scan-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  execFileSync('git', ['-C', root, 'init', '-q'], { env: gitEnv })
  for (const [path, body] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), body)
  }
  return root
}
function run(root, ...extra) {
  const result = spawnSync(process.execPath, [script, 'scan', ...extra], { cwd: root, encoding: 'utf8', env: gitEnv })
  return { code: result.status, data: JSON.parse(result.stdout) }
}
const chinese = '这个项目负责订单的创建、支付回调和状态流转，并向库存服务发送扣减请求。'.repeat(20)
const english = 'This service creates orders, handles payment callbacks and moves order states forward. '.repeat(20)

test('scan suggests Chinese for a Chinese project and Chinese paths when no document paths exist', async t => {
  const root = await repo(t, {
    'README.md': `# 订单服务\n\n${chinese}\n\n\`\`\`js\n${english}\n\`\`\`\n`,
    'package.json': '{"name":"orders"}\n',
    'src/index.js': '// 启动入口\nexport const start = () => {}\n',
    'src/order/service.ts': 'export class OrderService {}\n',
  })
  const { code, data } = run(root)
  assert.equal(code, 0)
  assert.equal(data.root, root)
  assert.equal(data.language.suggested, 'zh-CN')
  assert.equal(data.language.pathLanguage, 'zh-CN')
  assert.deepEqual(data.entries, ['package.json', 'src/index.js'])
  assert.deepEqual(data.languages.map(item => item.language).sort(), ['JavaScript', 'TypeScript'])
  assert.ok(data.directories.some(item => item.path === 'src' && item.files === 2))
})

test('scan keeps ASCII paths when existing documents use them, and English for English prose', async t => {
  const zh = await repo(t, { 'README.md': chinese, 'docs/guide/setup.md': `# 安装\n\n${chinese}` })
  assert.deepEqual([run(zh).data.language.suggested, run(zh).data.language.pathLanguage], ['zh-CN', 'en'])
  const en = await repo(t, { 'README.md': english, 'docs/指南.md': english })
  assert.deepEqual([run(en).data.language.suggested, run(en).data.language.pathLanguage], ['en', 'zh-CN'])
})

test('an existing catalog decides languages and too little prose yields no suggestion', async t => {
  const root = await repo(t, {
    'README.md': english,
    'docs/wiki/catalog.json': JSON.stringify({ version: 2, language: 'zh-CN', pathLanguage: 'en', pages: [] }),
  })
  assert.deepEqual([run(root).data.language.suggested, run(root).data.language.pathLanguage], ['zh-CN', 'en'])
  const bare = await repo(t, { 'src/main.go': 'package main\n' })
  const { data } = run(bare, '--root', bare)
  assert.equal(data.language.suggested, null)
  assert.match(data.language.evidence.join('\n'), /conversation language/)
  assert.deepEqual(data.entries, ['src/main.go'])
})

test('scan rejects a wiki path outside the project', async t => {
  const root = await repo(t, { 'README.md': english })
  assert.equal(run(root, '--wiki', '../elsewhere').code, 2)
})
