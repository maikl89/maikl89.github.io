/**
 * ContextGenerator - Builds animation context summaries
 */

import { isObject } from '../../utils/validation.js'

export class ContextGenerator {
  generate(animators = {}) {
    const items = {}

    Object.entries(animators).forEach(([property, animator]) => {
      if (!animator || !Array.isArray(animator.keys)) return
      const keys = animator.keys
        .filter(key => isObject(key))
        .map(key => ({
          time: key.time || 0,
          value: key.value,
          easing: key.easing || 'linear'
        }))

      items[property] = {
        property,
        keyCount: keys.length,
        startTime: keys.length ? keys[0].time : 0,
        endTime: keys.length ? keys[keys.length - 1].time : 0,
        keys
      }
    })

    return {
      version: '0.1',
      generatedAt: Date.now(),
      items
    }
  }
}
