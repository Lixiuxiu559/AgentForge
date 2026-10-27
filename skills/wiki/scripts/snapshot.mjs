import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'

export const digest = value => createHash('sha256').update(value).digest('hex')
export const matches = (path, prefix) => prefix === '.' || path === prefix || path.startsWith(`${prefix}/`)

/** A candidate is read from one explicitly selected Git index, tree, or worktree. */
export async function createSnapshot({ root, scope, head, git }) {
  if (resolve(git(root, ['rev-parse', '--show-toplevel']).trim()) !== root) throw new Error('--root must be the Git repository root')
  const entries = new Map()
  if (scope === 'range') {
    for (const field of git(root, ['ls-tree', '-r', '-z', head]).split('\0').filter(Boolean)) {
      const match = /^(\d+) (\w+) ([0-9a-f]+)\t([\s\S]+)$/.exec(field)
      if (!match) throw new Error('Malformed Git tree inventory')
      entries.set(match[4], { mode: match[1], oid: match[3] })
    }
  } else {
    for (const field of git(root, ['ls-files', '--stage', '-z']).split('\0').filter(Boolean)) {
      const match = /^(\d+) ([0-9a-f]+) (\d+)\t([\s\S]+)$/.exec(field)
      if (!match || match[3] !== '0') throw new Error('Unmerged or malformed Git index')
      entries.set(match[4], { mode: match[1], oid: match[2] })
    }
    if (scope === 'worktree') {
      for (const path of git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)) entries.set(path, {})
    }
  }
  const cache = new Map()
  async function read(path) {
    if (cache.has(path)) return cache.get(path)
    if (!entries.has(path)) return undefined
    let result
    if (scope === 'worktree') {
      let current = root
      const parts = path.split('/')
      try {
        for (let i = 0; i < parts.length; i++) {
          current = resolve(current, parts[i])
          const rel = relative(root, current)
          if (rel === '..' || rel.startsWith(`..${sep}`)) throw new Error('Snapshot path escapes project')
          const info = await lstat(current)
          if (info.isSymbolicLink()) throw new Error(`Symbolic links cannot establish freshness: ${path}`)
          if (i === parts.length - 1) {
            if (!info.isFile()) throw new Error(`Unsupported freshness source: ${path}`)
            result = { content: await readFile(current), mode: info.mode & 0o111 ? '100755' : '100644' }
          }
        }
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
      }
    } else {
      const entry = entries.get(path)
      if (!['100644', '100755'].includes(entry.mode)) throw new Error(`Unsupported Git entry for freshness: ${path}`)
      // cat-file uses the object ID, so colons and newlines in file names are harmless.
      result = { content: git(root, ['cat-file', 'blob', entry.oid], true), mode: entry.mode }
    }
    cache.set(path, result)
    return result
  }
  return { scope, head, paths: [...entries.keys()].sort(), read }
}
