import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { cp, copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { devNull, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const manifests = [
  '.claude-plugin/plugin.json', '.codex-plugin/plugin.json', 'package.json',
]

async function releaseFixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'agentforge-release-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  // Ignore ambient Git state, identity, signing and hooks without changing the user's config.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')))
  Object.assign(env, { GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: '1' })
  const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim()
  await mkdir(join(root, 'tools'))
  await mkdir(join(root, 'empty-hooks'))
  await copyFile(join(ROOT, 'tools/release.mjs'), join(root, 'tools/release.mjs'))
  // This fixture exercises the release lifecycle; real doctor validation is covered separately.
  await writeFile(join(root, 'tools/doctor.mjs'), 'process.exit(0)\n')
  for (const file of manifests) {
    await mkdir(dirname(join(root, file)), { recursive: true })
    await writeFile(join(root, file), `${JSON.stringify({ name: 'agentforge', version: '1.2.3', fixture: file }, null, 2)}\n`)
  }
  await writeFile(join(root, 'CHANGELOG.md'), '# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Engineering workflow update.\n\n## [1.2.3] - 2026-01-01\n\n- Previous release.\n')
  git('init', '--initial-branch=main')
  git('config', 'user.name', 'Release Test')
  git('config', 'user.email', 'release-test@example.invalid')
  git('config', 'commit.gpgsign', 'false')
  git('config', 'tag.gpgsign', 'false')
  git('config', 'core.hooksPath', join(root, 'empty-hooks'))
  git('add', '.')
  git('commit', '-m', 'fixture baseline')
  const release = (...args) => execFileSync(process.execPath, [join(root, 'tools/release.mjs'), ...args], {
    cwd: root, env, encoding: 'utf8',
  })
  return { root, git, release }
}

test('release dry-run preserves all three manifests, changelog, commit and tags', async t => {
  const { root, git, release } = await releaseFixture(t)
  const files = [...manifests, 'CHANGELOG.md']
  const before = await Promise.all(files.map(file => readFile(join(root, file), 'utf8')))
  const head = git('rev-parse', 'HEAD')
  release('patch', '--dry-run')
  assert.deepEqual(await Promise.all(files.map(file => readFile(join(root, file), 'utf8'))), before)
  assert.equal(git('rev-parse', 'HEAD'), head)
  assert.equal(git('tag', '--list'), '')
  assert.equal(git('status', '--porcelain'), '')
})

test('patch release commits all three versions and changelog under the release tag', async t => {
  const { root, git, release } = await releaseFixture(t)
  const previousHead = git('rev-parse', 'HEAD')
  release('patch')
  for (const file of manifests) {
    const current = JSON.parse(await readFile(join(root, file), 'utf8'))
    assert.equal(current.version, '1.2.4', file)
    assert.equal(current.fixture, file, `${file} keeps unrelated metadata`)
    assert.equal(JSON.parse(git('show', `v1.2.4:${file}`)).version, '1.2.4', `${file} is included in the tagged commit`)
  }
  const changelog = await readFile(join(root, 'CHANGELOG.md'), 'utf8')
  assert.match(changelog, /^## \[Unreleased\]/m)
  assert.match(changelog, /^## \[1\.2\.4\] - \d{4}-\d{2}-\d{2}\n\n### Added\n\n- Engineering workflow update\./m)
  assert.match(changelog, /^## \[1\.2\.3\] - 2026-01-01\n\n- Previous release\./m)
  assert.deepEqual(git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD').split('\n').sort(), [...manifests, 'CHANGELOG.md'].sort())
  assert.equal(git('log', '-1', '--format=%s'), 'chore(release): v1.2.4')
  assert.equal(git('rev-parse', 'HEAD^'), previousHead)
  assert.equal(git('rev-parse', 'v1.2.4^{}'), git('rev-parse', 'HEAD'))
  assert.equal(git('cat-file', '-t', 'v1.2.4'), 'tag')
  assert.equal(git('status', '--porcelain'), '')
})

test('real doctor accepts the three supported manifests and rejects version drift in each', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'agentforge-doctor-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const file of ['.claude-plugin', '.codex-plugin', '.agents/plugins', 'package.json', 'src', 'skills', 'cordis.patch.yml', 'tools']) {
    await mkdir(dirname(join(root, file)), { recursive: true })
    await cp(join(ROOT, file), join(root, file), { recursive: true })
  }
  const doctor = () => spawnSync(process.execPath, [join(root, 'tools/doctor.mjs')], { encoding: 'utf8' })
  const baseline = doctor()
  assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr)
  for (const file of manifests) {
    const target = join(root, file)
    const original = await readFile(target, 'utf8')
    await writeFile(target, JSON.stringify({ ...JSON.parse(original), version: '99.0.0' }))
    const run = doctor()
    assert.equal(run.status, 1, file)
    assert.match(run.stdout, /三处版本号不一致/, file)
    await writeFile(target, original)
  }
})
