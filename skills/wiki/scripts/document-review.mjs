import { readFile } from 'node:fs/promises'
import { dirname, posix } from 'node:path'

// A read-only work packet, not a semantic checker or a list of mandatory sources.
export async function documentReview({ root, document, files, modules }) {
  if (!files.includes(document) || !/\.md$/i.test(document)) throw new Error('--document must name a Git-visible regular Markdown file')
  const owners = modules.filter(module => module.documents.includes(document))
  const text = await readFile(`${root}/${document}`, 'utf8')
  const lines = text.split(/\r?\n/), passages = [], references = []
  let section = '', start = null, block = [], fence = null
  const flush = () => {
    if (block.length) passages.push({ line: start + 1, endLine: start + block.length, section, text: block.join('\n') })
    block = []; start = null
  }
  for (let i = 0; i < lines.length; i++) {
    const marker = lines[i].match(/^ {0,3}(`{3,}|~{3,})/)
    const heading = !fence && !marker && lines[i].match(/^#{1,6}\s+(.+)/)
    if (marker) {
      if (!fence) fence = marker[1]
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && /^ {0,3}(`+|~+)\s*$/.test(lines[i])) fence = null
    }
    if (heading) { flush(); section = heading[1]; continue }
    if (!lines[i].trim()) { flush(); continue }
    if (start === null) start = i
    block.push(lines[i])
    const tokens = []
    for (const match of lines[i].matchAll(/`([^`\n]+)`/g)) tokens.push({ value: match[1], kind: 'code' })
    for (const match of lines[i].matchAll(/\[[^\]\n]*\]\(([^\s()]+)\)/g)) tokens.push({ value: match[1], kind: 'link' })
    for (const token of tokens) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/|\\)/i.test(token.value)) continue
      let value
      try { value = decodeURIComponent(token.value.split('#')[0].split('?')[0]).replace(/:\d+(?:-\d+)?$/, '') }
      catch { continue }
      if (!value || !value.includes('.') || /[*{}]/.test(value)) continue
      const relative = posix.normalize(posix.join(dirname(document), value))
      const exact = token.kind === 'link' ? relative : value.replace(/^\.\//, '')
      const candidates = token.kind === 'code' && !value.includes('/') ? files.filter(path => posix.basename(path) === value) : files.includes(exact) ? [exact] : []
      // Only actual repository files are candidates; commands/URLs are not sources.
      if (!candidates.length) continue
      references.push({ line: i + 1, literal: token.value, kind: token.kind, ambiguous: candidates.length > 1,
        candidates: candidates.map(path => ({ path, owners: owners.map(module => ({ module: module.id, mappedSource: module.sourceFiles.includes(path) })) })) })
    }
  }
  flush()
  return {
    document, owningModules: owners.map(module => module.id),
    assessment: 'agent-work-packet; references are lexical candidates, not semantic dependencies',
    instructions: [
      'For each relevant passage, trace important claims to original evidence; distinguish platform, channel, condition and time.',
      'Correct the actual sentence/table/step, then search its repeated assertions and cited current documents.',
      'Confirm real dependencies in each owning module; a navigation link or lexical match alone does not require mapping.',
      'Read back the edited document, rerun this packet if it changed, then record only completed review scope.',
    ],
    passages, references,
    limitations: ['Unmentioned dependencies and semantic contradictions require agent investigation; this packet does not prove correctness.'],
  }
}
