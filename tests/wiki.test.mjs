import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, realpath, mkdir, writeFile, readFile, rm, rename, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../skills/wiki/scripts/wiki.mjs', import.meta.url))
const gitEnv = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete gitEnv[key]

async function fixture(t, git = false) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'agentforge-wiki-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  if (git) {
    gitRun(root, 'init', '-q')
    await put(root, 'initial.txt', 'initial\n')
    gitRun(root, 'add', '.')
    gitRun(root, 'commit', '-qm', 'Initial fixture')
  }
  return root
}

function gitRun(root, ...args) {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'user.name=Wiki Test',
    '-c', 'user.email=wiki-test@example.invalid', '-c', 'commit.gpgsign=false', '-C', root, ...args],
  { encoding: 'utf8', env: gitEnv }).trim()
}

async function put(root, path, content) {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), content)
}

function run(root, ...args) {
  const result = spawnSync(process.execPath, [script, args[0], '--root', root, ...args.slice(1)],
    { cwd: tmpdir(), encoding: 'utf8', env: gitEnv })
  assert.equal(result.signal, null, result.stderr)
  assert.equal(result.error, undefined)
  let body
  try { body = JSON.parse(result.stdout) } catch {
    assert.fail(`Expected JSON, exit=${result.status}: ${result.stdout}\n${result.stderr}`)
  }
  assert.ok(['passed', 'issues', 'partial', 'error'].includes(body.status))
  assert.ok(Array.isArray(body.findings))
  assert.equal(body.coverage.semantic, 'not_run')
  assert.equal(result.status, body.status === 'passed' ? 0 : body.status === 'error' ? 2 : 1)
  return body
}

async function config(root, modules) {
  await put(root, 'wiki.config.json', JSON.stringify({ version: 1, modules }))
}

test('nested list links cannot silently pass and whole-project mappings work in both commands', async t => {
  const root = await fixture(t, true)
  await put(root, 'wiki/start.md', '# Start\n\n- Parent\n    - [Missing](absent.md)\n')
  assert.notEqual(run(root, 'check', '--wiki', 'wiki').status, 'passed')
  await put(root, 'wiki/start.md', '# Start\n')
  await config(root, [{ id: 'all', sources: ['.'], docs: ['wiki/start.md'] }])
  assert.equal(run(root, 'check', '--wiki', 'wiki', '--config', 'wiki.config.json').status, 'passed')
  const result = run(root, 'changes', '--scope', 'worktree', '--config', 'wiki.config.json')
  assert.equal(result.status, 'passed')
  assert.ok(result.changes.length > 0)
  assert.ok(result.changes.every(change => change.modules.includes('all')))
})

test('explicit root wins over inherited Git index and repository environment', async t => {
  const root = await fixture(t, true)
  const foreign = await fixture(t, true)
  await put(root, 'wanted.txt', 'wanted\n')
  gitRun(root, 'add', 'wanted.txt')
  await put(foreign, 'foreign.txt', 'not wanted\n')
  gitRun(foreign, 'add', 'foreign.txt')
  const result = spawnSync(process.execPath, [script, 'changes', '--root', root, '--scope', 'staged'], {
    cwd: tmpdir(), encoding: 'utf8', env: {
      ...gitEnv, GIT_DIR: join(foreign, '.git'), GIT_WORK_TREE: root,
      GIT_INDEX_FILE: join(foreign, '.git/index'),
    },
  })
  const body = JSON.parse(result.stdout)
  assert.equal(body.status, 'partial')
  assert.deepEqual(body.changes.map(change => change.path), ['wanted.txt'])
})

test('check accepts a single project-owned page from an unrelated cwd without changing it', async t => {
  const root = await fixture(t)
  const content = '# A small CLI\n\nNo role table or module template is required.\n'
  await put(root, 'knowledge/start.md', content)
  const result = run(root, 'check', '--wiki', 'knowledge')
  assert.equal(result.status, 'passed')
  assert.equal(await readFile(join(root, 'knowledge/start.md'), 'utf8'), content)
})

test('missing and empty wiki cannot be reported as passed', async t => {
  const root = await fixture(t)
  assert.notEqual(run(root, 'check', '--wiki', 'missing').status, 'passed')
  await mkdir(join(root, 'empty'))
  assert.notEqual(run(root, 'check', '--wiki', 'empty').status, 'passed')
})

test('relative Markdown targets and Chinese anchors work; fenced examples are not links', async t => {
  const root = await fixture(t)
  await put(root, 'docs/guide.md', '# 使用说明\n\n## 配置\n')
  await put(root, 'wiki/README.md', '# Index\n\n[指南](../docs/guide.md#配置)\n\n```md\n[example](./missing.md)\n```\n')
  assert.equal(run(root, 'check', '--wiki', 'wiki').status, 'passed')
  await put(root, 'wiki/README.md', '# Index\n\n[指南](../docs/guide.md#不存在)\n')
  assert.equal(run(root, 'check', '--wiki', 'wiki').status, 'issues')
  await put(root, 'wiki/README.md', '# Index\n\n[缺失](../docs/absent.md)\n')
  assert.equal(run(root, 'check', '--wiki', 'wiki').status, 'issues')
})

test('configuration validates structure and configured source/document existence', async t => {
  const root = await fixture(t)
  await put(root, 'wiki/start.md', '# Start\n')
  await put(root, 'wiki.config.json', '{ broken')
  assert.equal(run(root, 'check', '--wiki', 'wiki', '--config', 'wiki.config.json').status, 'error')
  await config(root, [{ id: 'a', sources: ['src'], docs: ['wiki/start.md'] }])
  assert.notEqual(run(root, 'check', '--wiki', 'wiki', '--config', 'wiki.config.json').status, 'passed')
  await put(root, 'src/main.js', 'export const value = 1\n')
  assert.equal(run(root, 'check', '--wiki', 'wiki', '--config', 'wiki.config.json').status, 'passed')
  await config(root, [{ id: 'a', sources: ['src'], docs: ['wiki/missing.md'] }])
  assert.notEqual(run(root, 'check', '--wiki', 'wiki', '--config', 'wiki.config.json').status, 'passed')
})

test('unknown options, invalid refs, and non-repositories fail closed', async t => {
  const root = await fixture(t)
  assert.equal(run(root, 'check', '--wiki', 'wiki', '--unknown', 'value').status, 'error')
  assert.equal(run(root, 'changes', '--scope', 'staged').status, 'error')
  const repo = await fixture(t, true)
  assert.equal(run(repo, 'changes', '--scope', 'range', '--base', 'nonexistent-ref').status, 'error')
  await put(root, 'wiki/start.md', '# Start\n')
  assert.equal(run(basename(root), 'check', '--wiki', 'wiki').status, 'error')
})

test('ambiguous module IDs and paths outside the project are rejected', async t => {
  const root = await fixture(t)
  await put(root, 'wiki/start.md', '# Start\n')
  const module = { id: 'same', sources: ['wiki'], docs: ['wiki/start.md'] }
  await config(root, [module, module])
  assert.equal(run(root, 'check', '--wiki', 'wiki', '--config', 'wiki.config.json').status, 'error')
  await config(root, [{ ...module, sources: ['../outside'] }])
  assert.equal(run(root, 'check', '--wiki', 'wiki', '--config', 'wiki.config.json').status, 'error')
  await config(root, [{ ...module, sources: ['src/**/*.js'] }])
  assert.equal(run(root, 'check', '--wiki', 'wiki', '--config', 'wiki.config.json').status, 'error')
  await config(root, [{ ...module, source: ['wiki'] }])
  assert.equal(run(root, 'check', '--wiki', 'wiki', '--config', 'wiki.config.json').status, 'error')
  await put(root, 'wiki.config.json', JSON.stringify({ version: 1, modules: [module], module: [] }))
  assert.equal(run(root, 'check', '--wiki', 'wiki', '--config', 'wiki.config.json').status, 'error')
})

test('reference-style links and repeated heading anchors are checked', async t => {
  const root = await fixture(t)
  await put(root, 'wiki/guide.md', '# Repeat\n\n## Repeat\n')
  await put(root, 'wiki/start.md', '# Start\n\n[guide][target]\n[target]: ./guide.md#repeat-1\n')
  assert.equal(run(root, 'check', '--wiki', 'wiki').status, 'passed')
  await put(root, 'wiki/start.md', '# Start\n\n[guide][target]\n[target]: ./guide.md#repeat-2\n')
  assert.equal(run(root, 'check', '--wiki', 'wiki').status, 'issues')
  await put(root, 'wiki/start.md', '# Start\n\n[guide][undefined]\n')
  assert.equal(run(root, 'check', '--wiki', 'wiki').status, 'issues')
})

test('unsupported complex links are partial and fenced HTML IDs do not create anchors', async t => {
  const root = await fixture(t)
  await put(root, 'wiki/start.md', '# Start\n\n[complex](./guide(with-parens).md)\n')
  assert.equal(run(root, 'check', '--wiki', 'wiki').status, 'partial')
  await put(root, 'wiki/start.md', '# Start\n\n[example](#not-a-heading)\n\n```html\n<a id="not-a-heading"></a>\n```\n')
  assert.equal(run(root, 'check', '--wiki', 'wiki').status, 'issues')
})

test('empty staged scope passes mechanically and changed documentation maps via docs', async t => {
  const root = await fixture(t, true)
  await put(root, 'wiki/start.md', '# Initial\n')
  await config(root, [{ id: 'guide', sources: [], docs: ['wiki/start.md'] }])
  gitRun(root, 'add', '.')
  gitRun(root, 'commit', '-qm', 'Guide')
  const empty = run(root, 'changes', '--scope', 'staged', '--config', 'wiki.config.json')
  assert.equal(empty.status, 'passed')
  assert.deepEqual(empty.changes, [])
  assert.equal(empty.coverage.semantic, 'not_run')
  await put(root, 'wiki/start.md', '# Revised\n')
  gitRun(root, 'add', 'wiki/start.md')
  const result = run(root, 'changes', '--scope', 'staged', '--config', 'wiki.config.json')
  assert.deepEqual(result.changes.map(c => c.path), ['wiki/start.md'])
  assert.deepEqual(result.changes[0].modules, ['guide'])
  assert.equal(result.status, 'passed')
})

test('staged changes support a repository without its first commit and newline paths', async t => {
  const root = await fixture(t)
  gitRun(root, 'init', '-q')
  await put(root, '新\n文件.js', 'export const initial = 1\n')
  gitRun(root, 'add', '.')
  const result = run(root, 'changes', '--scope', 'staged')
  assert.equal(result.status, 'partial')
  assert.deepEqual(result.changes.map(c => c.path), ['新\n文件.js'])
})

test('staged changes remain visible when worktree restores HEAD; worktree includes untracked', async t => {
  const root = await fixture(t, true)
  await put(root, 'src/value.js', 'export const value = 1\n')
  await put(root, 'wiki/start.md', '# Value\n')
  await config(root, [{ id: 'value', sources: ['src'], docs: ['wiki/start.md'] }])
  gitRun(root, 'add', '.')
  gitRun(root, 'commit', '-qm', 'Add value')
  await put(root, 'src/value.js', 'export const value = 2\n')
  gitRun(root, 'add', 'src/value.js')
  await put(root, 'src/value.js', 'export const value = 1\n')
  await put(root, 'src/新 文件.js', 'export const extra = true\n')
  const staged = run(root, 'changes', '--scope', 'staged', '--config', 'wiki.config.json')
  assert.deepEqual(staged.changes.map(c => c.path), ['src/value.js'])
  assert.deepEqual(staged.changes[0].modules, ['value'])
  const working = run(root, 'changes', '--scope', 'worktree', '--config', 'wiki.config.json')
  assert.deepEqual(working.changes.map(c => c.path).sort(), ['src/value.js', 'src/新 文件.js'].sort())
})

test('renames and deletions preserve Unicode paths and map both old and new locations', async t => {
  const root = await fixture(t, true)
  await put(root, '旧目录/订单 文件.js', 'export const order = 1\n')
  await put(root, '旧目录/删除.js', 'export const obsolete = true\n')
  await put(root, 'wiki/start.md', '# Modules\n')
  await config(root, [
    { id: 'old', sources: ['旧目录'], docs: ['wiki/start.md'] },
    { id: 'new', sources: ['新目录'], docs: ['wiki/start.md'] },
  ])
  gitRun(root, 'add', '.')
  gitRun(root, 'commit', '-qm', 'Add Unicode files')
  await mkdir(join(root, '新目录'))
  await rename(join(root, '旧目录/订单 文件.js'), join(root, '新目录/订单 文件.js'))
  await rm(join(root, '旧目录/删除.js'))
  gitRun(root, 'add', '-A')
  const result = run(root, 'changes', '--scope', 'staged', '--config', 'wiki.config.json')
  const moved = result.changes.find(c => c.path === '新目录/订单 文件.js')
  assert.ok(moved)
  assert.equal(moved.oldPath, '旧目录/订单 文件.js')
  assert.deepEqual([...moved.modules].sort(), ['new', 'old'])
  const deleted = result.changes.find(c => c.path === '旧目录/删除.js')
  assert.ok(deleted)
  assert.match(deleted.status, /^D/)
  assert.deepEqual(deleted.modules, ['old'])
})

test('range compares merge-base to head and excludes unrelated base-branch changes', async t => {
  const root = await fixture(t, true)
  const ancestor = gitRun(root, 'rev-parse', 'HEAD')
  gitRun(root, 'checkout', '-qb', 'wiki-feature')
  await put(root, 'feature.txt', 'feature\n')
  gitRun(root, 'add', '.')
  gitRun(root, 'commit', '-qm', 'Feature')
  const head = gitRun(root, 'rev-parse', 'HEAD')
  gitRun(root, 'checkout', '-qb', 'wiki-base', ancestor)
  await put(root, 'base-only.txt', 'base\n')
  gitRun(root, 'add', '.')
  gitRun(root, 'commit', '-qm', 'Base change')
  const result = run(root, 'changes', '--scope', 'range', '--base', 'wiki-base', '--head', head)
  assert.deepEqual(result.changes.map(c => c.path), ['feature.txt'])
  assert.equal(result.status, 'partial')
})

test('unmapped changes are reported as incomplete coverage rather than passed', async t => {
  const root = await fixture(t, true)
  await put(root, 'unknown.txt', 'new\n')
  const result = run(root, 'changes', '--scope', 'worktree')
  assert.equal(result.status, 'partial')
  assert.deepEqual(result.changes.map(c => c.path), ['unknown.txt'])
  assert.deepEqual(result.changes[0].modules, [])
  assert.ok(result.unmapped.length > 0)
})

test('links and symlinks outside the requested root are never treated as checked', async t => {
  const root = await fixture(t)
  const outside = await fixture(t)
  await put(outside, 'private.md', '# SECRET\n[broken](missing.md)\n')
  await put(root, 'wiki/start.md', '# Start\n[external](./escape.md#secret)\n')
  await symlink(join(outside, 'private.md'), join(root, 'wiki/escape.md'))
  const result = run(root, 'check', '--wiki', 'wiki')
  assert.notEqual(result.status, 'passed')
  assert.ok(!JSON.stringify(result).includes('SECRET'))
  assert.ok(!JSON.stringify(result).includes('missing.md'))
})
