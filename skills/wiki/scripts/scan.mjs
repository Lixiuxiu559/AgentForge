// Read-only repository scan that feeds catalog planning. It never calls a model
// and never writes files; language values are suggestions with their evidence.
import { lstat, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const LANGUAGES = {
  js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript',
  py: 'Python', go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin', kts: 'Kotlin', scala: 'Scala', rb: 'Ruby', php: 'PHP', cs: 'C#',
  c: 'C', h: 'C', cc: 'C++', cpp: 'C++', hpp: 'C++', swift: 'Swift', m: 'Objective-C', dart: 'Dart', lua: 'Lua', ex: 'Elixir', exs: 'Elixir',
  sh: 'Shell', bash: 'Shell', zsh: 'Shell', ps1: 'PowerShell', sql: 'SQL', vue: 'Vue', svelte: 'Svelte', html: 'HTML', css: 'CSS', scss: 'CSS',
}
const DOC = /\.(?:md|mdx|markdown|rst|adoc|txt)$/i
const ENTRY = [
  /(?:^|\/)(?:package\.json|pyproject\.toml|setup\.py|requirements\.txt|go\.mod|Cargo\.toml|pom\.xml|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?|composer\.json|Gemfile|mix\.exs|pubspec\.yaml|CMakeLists\.txt|Makefile)$/,
  /(?:^|\/)(?:Dockerfile[^/]*|docker-compose[^/]*\.ya?ml|compose\.ya?ml|Procfile|serverless\.ya?ml)$/,
  /^\.github\/workflows\/[^/]+\.ya?ml$|^\.gitlab-ci\.yml$|^Jenkinsfile$/,
  /^(?:(?:src|app|lib|server|cmd\/[^/]+)\/)?(?:main|index|app|server|cli|__main__)\.[a-z]+$/,
  /(?:^|\/)(?:routes?|router|urls)(?:\.[a-z]+|\/index\.[a-z]+)$/,
]
const FIXED_NAMES = /^(?:README|CHANGELOG|LICENSE|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT|AGENTS|CLAUDE)(?:\.[a-z]+)?$/i
const CJK = /[\u3400-\u9fff\uf900-\ufaff]/g, HAS_CJK = /[\u3400-\u9fff\uf900-\ufaff]/
const WORD = /[A-Za-z]{2,}/g
const SAMPLE_LIMIT = 200, BYTE_LIMIT = 256 * 1024, MIN_TOKENS = 200

export function tokens(text) {
  return { cjk: (text.match(CJK) || []).length, words: (text.match(WORD) || []).length }
}
export function prose(text) {
  return text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '').replace(/\]\([^)]*\)|https?:\/\/\S+/g, '')
}
function comments(text) {
  const lines = text.match(/(?:\/\/|#|--|\/\*+|^\s*\*)\s?[^\n]*/gm) || []
  return lines.join('\n')
}
export function verdict(count) {
  const total = count.cjk + count.words
  if (total < MIN_TOKENS) return null
  return count.cjk / total >= 0.35 ? 'zh-CN' : 'en'
}
async function text(root, path) {
  const info = await lstat(join(root, path)).catch(() => null)
  if (!info?.isFile() || info.size > BYTE_LIMIT) return null
  const body = await readFile(join(root, path), 'utf8')
  return body.includes('\0') ? null : body
}
function add(target, count) { target.cjk += count.cjk; target.words += count.words }

export async function scan({ root, wiki, git, limited }) {
  const files = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean).sort()
  const sizes = new Map()
  for (const file of files) {
    const info = await lstat(join(root, file)).catch(() => null)
    if (info?.isFile()) sizes.set(file, info.size)
  }
  const present = files.filter(file => sizes.has(file))

  const languages = new Map(), directories = new Map()
  for (const file of present) {
    const ext = file.includes('.') ? file.slice(file.lastIndexOf('.') + 1).toLowerCase() : ''
    const name = LANGUAGES[ext]
    if (name) {
      const entry = languages.get(name) || { language: name, files: 0, bytes: 0 }
      entry.files++; entry.bytes += sizes.get(file); languages.set(name, entry)
    }
    const parts = file.split('/')
    for (const depth of [1, 2]) {
      if (parts.length <= depth) break
      const dir = parts.slice(0, depth).join('/')
      const entry = directories.get(dir) || { path: dir, files: 0, bytes: 0 }
      entry.files++; entry.bytes += sizes.get(file); directories.set(dir, entry)
    }
  }
  const docs = present.filter(file => DOC.test(file) && (!file.includes('/') || file.startsWith('docs/') || (wiki && file.startsWith(`${wiki}/`))))
  const code = present.filter(file => LANGUAGES[file.slice(file.lastIndexOf('.') + 1).toLowerCase()] && !DOC.test(file))
  const signals = { docs: { files: 0, cjk: 0, words: 0 }, other: { files: 0, cjk: 0, words: 0 } }
  for (const file of docs.slice(0, SAMPLE_LIMIT)) {
    const body = await text(root, file)
    if (body !== null) { signals.docs.files++; add(signals.docs, tokens(prose(body))) }
  }
  for (const file of code.slice(0, SAMPLE_LIMIT)) {
    const body = await text(root, file)
    if (body !== null) { signals.other.files++; add(signals.other, tokens(comments(body))) }
  }
  let head = true
  try { git(root, ['rev-parse', '--verify', '--quiet', 'HEAD']) } catch { head = false }
  if (head) add(signals.other, tokens(git(root, ['log', '-n', '100', '--format=%s%n%b'])))
  if (docs.length > SAMPLE_LIMIT || code.length > SAMPLE_LIMIT) limited(`Language signals sampled from the first ${SAMPLE_LIMIT} files per category`)

  const catalog = wiki ? await text(root, `${wiki}/catalog.json`).then(body => body && JSON.parse(body)).catch(() => null) : null
  const evidence = []
  let language = null
  if (typeof catalog?.language === 'string') { language = catalog.language; evidence.push(`Existing catalog declares ${language}`) }
  for (const [key, label] of [['docs', 'README and docs/ prose'], ['other', 'code comments and commit messages']]) {
    const found = verdict(signals[key])
    if (!language && found) { language = found; evidence.push(`${label}: ${signals[key].cjk} CJK characters, ${signals[key].words} English words`) }
  }
  if (!language) evidence.push('No decisive project signal; use the conversation language')

  let pathLanguage = typeof catalog?.pathLanguage === 'string' ? catalog.pathLanguage : null
  if (pathLanguage) evidence.push(`Existing catalog declares path language ${pathLanguage}`)
  else {
    const segments = docs.filter(file => file.includes('/')).flatMap(file => file.split('/').slice(1)).map(part => part.replace(/\.[^.]+$/, ''))
      .filter(part => part && !FIXED_NAMES.test(part))
    const cjk = segments.filter(part => HAS_CJK.test(part)).length, ascii = segments.length - cjk
    if (segments.length) {
      pathLanguage = cjk > ascii ? 'zh-CN' : 'en'
      evidence.push(`Existing document paths: ${cjk} CJK and ${ascii} ASCII names`)
    } else {
      pathLanguage = language
      evidence.push('No existing document paths to follow; path language follows the document language')
    }
  }

  return {
    files: present.length,
    languages: [...languages.values()].sort((a, b) => b.bytes - a.bytes),
    entries: present.filter(file => ENTRY.some(pattern => pattern.test(file))),
    directories: [...directories.values()].sort((a, b) => b.files - a.files || a.path.localeCompare(b.path)).slice(0, 40),
    docs: docs.slice(0, 100),
    language: { suggested: language, pathLanguage, evidence, signals },
  }
}
