#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [command, ...args] = process.argv.slice(2)
if (!['check', 'mapping', 'freshness', 'review', 'gate'].includes(command)) {
  console.error('Usage: node tools/wiki-project.mjs check|mapping|freshness|review|gate [options]')
  process.exitCode = 2
} else {
  const defaults = command === 'check' ? ['--wiki', 'docs/wiki'] : []
  if (command === 'gate' && !args.includes('--scope')) defaults.push('--scope', 'worktree')
  const result = spawnSync(process.execPath, [
    resolve(root, 'skills/wiki/scripts/wiki.mjs'), command,
    '--root', root, '--config', 'docs/wiki/wiki.config.json', ...defaults, ...args,
  ], { cwd: root, stdio: 'inherit' })
  if (result.error) console.error(result.error.message)
  process.exitCode = result.status ?? 2
}
