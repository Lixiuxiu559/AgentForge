import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, realpath, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { apply, inject, PACKAGE_ROOT } from '../src/index.js'

function register(entry) {
  const providers = []
  // Deliberately no tools/subagents services: skills alone must be sufficient.
  entry({ skills: { registerProvider(factory) { providers.push(factory()) } } })
  assert.equal(providers.length, 1)
  return providers[0]
}

test('skills-only host discovers all six skills and preserves invocation policy and resources', async () => {
  assert.deepEqual(inject, ['skills'])
  const provider = register(apply)
  const candidates = await provider.list()
  assert.deepEqual(candidates.map(c => c.name).sort(), [
    'architecture-scout', 'complexity-audit', 'diff-review',
    'implementation-workflow', 'mutation-testing', 'research',
  ])
  for (const candidate of candidates) {
    assert.deepEqual(candidate.invocation, {
      modelInvocable: candidate.name !== 'architecture-scout', userInvocable: true,
    })
    assert.equal(candidate.content, undefined)
    const skill = await provider.get(candidate)
    const expectedDir = join(PACKAGE_ROOT, 'skills', candidate.name)
    assert.deepEqual(skill.resourceBase, { kind: 'directory', path: expectedDir })
    assert.equal(skill.path, join(expectedDir, 'SKILL.md'))
    assert.deepEqual(skill.invocation, candidate.invocation)
    assert.match(skill.content, /^# /)
    for (const [, reference] of skill.content.matchAll(/`(references\/[A-Za-z0-9._-]+)`/g)) {
      assert.ok((await readFile(join(skill.resourceBase.path, reference), 'utf8')).length)
    }
  }
})

test('relocated provider rescans additions/deletions and loads fresh content without cwd assumptions', async t => {
  const fixture = await realpath(await mkdtemp(join(tmpdir(), 'agentforge-provider-')))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  await mkdir(join(fixture, 'src'))
  await copyFile(join(PACKAGE_ROOT, 'src/index.js'), join(fixture, 'src/index.js'))
  await writeFile(join(fixture, 'package.json'), '{"type":"module"}')
  const relocated = await import(pathToFileURL(join(fixture, 'src/index.js')).href)
  assert.notEqual(resolve(process.cwd()), fixture)
  const provider = register(relocated.apply)
  assert.deepEqual(await provider.list(), [])
  const skillFile = join(fixture, 'skills', 'example', 'SKILL.md')
  await mkdir(dirname(skillFile), { recursive: true })
  const header = '---\nname: example\ndescription: Example\nuser-invocable: false\ndisable-model-invocation: true\n---\n'
  await writeFile(skillFile, header + '# Original')
  const [candidate] = await provider.list()
  assert.equal(candidate.name, 'example')
  assert.deepEqual(candidate.invocation, { modelInvocable: false, userInvocable: false })
  await writeFile(skillFile, header + '# Updated\n${CLAUDE_PLUGIN_ROOT}/skills/example')
  const loaded = await provider.get(candidate)
  assert.equal(loaded.content, `# Updated\n${fixture}/skills/example`)
  assert.equal(loaded.resourceBase.path, dirname(skillFile))
  await writeFile(join(fixture, 'skills', 'flat.md'), '---\nname: flat\ndescription: Flat\n---\n# Flat')
  await writeFile(join(fixture, 'skills', 'invalid.md'), '# Missing metadata')
  await writeFile(join(fixture, 'skills', '.hidden.md'), header + '# Hidden')
  await mkdir(join(fixture, 'skills', 'nested', 'child'), { recursive: true })
  await writeFile(join(fixture, 'skills', 'nested', 'child', 'SKILL.md'), header + '# Nested')
  assert.deepEqual((await provider.list()).map(c => c.name).sort(), ['example', 'flat'])
  await rm(dirname(skillFile), { recursive: true })
  assert.deepEqual((await provider.list()).map(c => c.name), ['flat'])
  await assert.rejects(provider.get(candidate), { code: 'ENOENT' })
})
