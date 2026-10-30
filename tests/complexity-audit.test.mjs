import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../skills/complexity-audit/scripts/crap.cjs', import.meta.url))

test('crap calculator runs from the source tree whose package.json declares type: module', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'agentforge-crap-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  // A target project that is itself ESM must not change how the script loads.
  await writeFile(join(dir, 'package.json'), '{"type":"module"}')
  const xml = join(dir, 'jacoco.xml')
  await writeFile(xml, '<report><package name="sample"><class name="sample/Example"><method name="run"><counter type="COMPLEXITY" missed="0" covered="2"/><counter type="LINE" missed="0" covered="3"/></method></class></package></report>')
  const run = spawnSync(process.execPath, [script, xml, '--lang', 'java'], { cwd: dir, encoding: 'utf8' })
  assert.equal(run.status, 0, run.stdout + run.stderr)
  assert.match(run.stdout, /sample\.Example#run/)
})
