import { readFile } from 'node:fs/promises'
import { dirname, posix } from 'node:path'

// A read-only work packet, not a semantic checker or a list of mandatory sources.
export async function documentReview({ root, document, files, modules }) {
  if (!files.includes(document) || !/\.md$/i.test(document)) throw new Error('--document must name a Git-visible regular Markdown file')
  const owners = modules.filter(module => module.documents.includes(document))
  const text = await readFile(`${root}/${document}`, 'utf8')
  const lines = text.split(/\r?\n/), passages = [], references = [], unresolvedReferences = []
  let section = '', start = null, block = [], fence = null
  const flush = () => {
    if (block.length) {
      const content = block.join('\n')
      passages.push({ line: start + 1, endLine: start + block.length, section, text: content })
    }
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
    if (/^\s*\|/.test(lines[i])) flush()
    if (start === null) start = i
    block.push(lines[i])
    if (/^\s*\|/.test(lines[i])) flush()
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
      if (!candidates.length) {
        if (!/\s/.test(value) && (value.includes('/') && /\.[^/]+$/.test(value) || /^[^.]+\.[a-z][a-z0-9]{0,9}$/i.test(value))) unresolvedReferences.push({ line: i + 1, literal: token.value, reason: '未匹配Git可见普通文件；可能是运行时路径，不能据此要求加入sources' })
        continue
      }
      references.push({ line: i + 1, literal: token.value, kind: token.kind, ambiguous: candidates.length > 1,
        candidates: candidates.map(path => ({ path, owners: owners.map(module => ({ module: module.id, mappedSource: module.sourceFiles.includes(path) })) })) })
    }
  }
  flush()
  const coveredSources = [], sourceGaps = [], partiallyCovered = [], ambiguousReferences = [], knowledgeReferences = []
  const knowledgePaths = new Set(modules.flatMap(module => module.documents))
  for (const reference of references) {
    const candidates = reference.candidates.map(candidate => ({
      path: candidate.path,
      coveredModules: candidate.owners.filter(o => o.mappedSource).map(o => o.module),
      missingModules: candidate.owners.filter(o => !o.mappedSource).map(o => o.module),
    }))
    const item = { line: reference.line, literal: reference.literal }
    if (reference.ambiguous) { ambiguousReferences.push({ ...item, candidates }); continue }
    const candidate = candidates[0]
    const flat = { ...item, ...candidate }
    if (knowledgePaths.has(candidate.path)) knowledgeReferences.push(flat)
    else if (!candidate.coveredModules.length) sourceGaps.push(flat)
    else if (candidate.missingModules.length) partiallyCovered.push(flat)
    else coveredSources.push(flat)
  }
  const coverageSummary = {
    covered: coveredSources.length, gaps: sourceGaps.length, partiallyCovered: partiallyCovered.length,
    ambiguous: ambiguousReferences.length, knowledgeReferences: knowledgeReferences.length, unresolved: unresolvedReferences.length,
  }
  return {
    coverageSummary,
    coverageMessage: `已覆盖 ${coverageSummary.covered}；本页未覆盖候选 ${coverageSummary.gaps}；多模块部分覆盖 ${coverageSummary.partiallyCovered}；同名歧义 ${coverageSummary.ambiguous}；知识引用 ${coverageSummary.knowledgeReferences}；未解析 ${coverageSummary.unresolved}（按引用位置计数）。字面候选不等于真实依赖，请直接核对下列清单。`,
    coveredSources, sourceGaps, partiallyCovered, ambiguousReferences, knowledgeReferences, unresolvedReferences,
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
