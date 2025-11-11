/**
 * Animator Utilities - Helper functions for animators
 */

import { KeyframeManager } from './KeyframeManager.js'
import { lerp } from '../../utils/math.js'

export function interpolateNumber(a, b, t) {
  return lerp(a, b, t)
}

export function interpolateVector(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') {
    return interpolateNumber(a, b, t)
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.map((val, index) => interpolateNumber(val, b[index], t))
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const result = {}
    Object.keys({ ...a, ...b }).forEach(key => {
      result[key] = interpolateNumber(a[key] || 0, b[key] || 0, t)
    })
    return result
  }

  return b
}

/**
 * Create an animator for a specific object/property.
 * @param {object} options
 * @param {string} options.objectId
 * @param {string} options.property
 * @param {Function} options.apply - Function to apply value to target
 * @param {KeyframeManager} options.keyframes - Keyframe manager instance
 * @param {Function} [options.interpolate=interpolateVector]
 */
export function createAnimator({
  objectId,
  property,
  apply,
  keyframes = new KeyframeManager(),
  interpolate = interpolateVector
}) {
  if (typeof objectId !== 'string') throw new Error('objectId is required')
  if (typeof property !== 'string') throw new Error('property is required')
  if (typeof apply !== 'function') throw new Error('apply function is required')

  return {
    update(time) {
      const value = keyframes.sample(objectId, property, time, interpolate)
      if (value !== null && value !== undefined) {
        apply(value, time)
      }
    }
  }
}
