/**
 * SemanticModuleSelector - Ranks modules against a user prompt
 */

import { clamp } from '../../utils/math.js'

export class SemanticModuleSelector {
  constructor({ minSimilarity = 0.1, topN = 5 } = {}) {
    this.minSimilarity = minSimilarity
    this.topN = topN
  }

  extractKeywords(text) {
    if (!text) return {}
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)

    const weights = {}
    tokens.forEach(token => {
      weights[token] = (weights[token] || 0) + 1
    })

    const max = Math.max(...Object.values(weights), 1)
    Object.keys(weights).forEach(key => {
      weights[key] = clamp(weights[key] / max, 0, 1)
    })

    return weights
  }

  cosine(a, b) {
    let dot = 0
    let aNorm = 0
    let bNorm = 0

    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    keys.forEach(key => {
      const av = a[key] || 0
      const bv = b[key] || 0
      dot += av * bv
      aNorm += av * av
      bNorm += bv * bv
    })

    if (aNorm === 0 || bNorm === 0) return 0
    return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm))
  }

  rankModules(userPrompt, modules) {
    const promptVector = this.extractKeywords(userPrompt)
    return modules
      .map(module => {
        const moduleVector = module.prompt || {}
        const similarity = this.cosine(promptVector, moduleVector)
        return { module, similarity }
      })
      .filter(entry => entry.similarity >= this.minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, this.topN)
  }

  selectBest(userPrompt, modules) {
    const ranked = this.rankModules(userPrompt, modules)
    return ranked.length > 0 ? ranked[0] : null
  }
}
