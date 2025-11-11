/**
 * KeyframeManager - Manages keyframes for objects and properties
 */

import { isNumber, isObject, isArray } from '../../utils/validation.js'

export class KeyframeManager {
  constructor() {
    this.keyframes = new Map() // Map<objectId, Map<property, keyframe[]>>
  }

  /**
   * Ensure storage for object/property exists.
   * @param {string} objectId
   * @param {string} property
   * @private
   */
  _ensure(objectId, property) {
    if (!this.keyframes.has(objectId)) {
      this.keyframes.set(objectId, new Map())
    }

    const map = this.keyframes.get(objectId)
    if (!map.has(property)) {
      map.set(property, [])
    }

    return map.get(property)
  }

  /**
   * Add keyframe to object/property.
   * @param {string} objectId
   * @param {string} property
   * @param {object} key - { time, value, easing }
   */
  addKeyframe(objectId, property, key) {
    if (!isObject(key) || !isNumber(key.time)) {
      throw new Error('Keyframe must have a numeric time')
    }

    const list = this._ensure(objectId, property)
    list.push({ ...key })
    list.sort((a, b) => a.time - b.time)
    return list
  }

  /**
   * Remove keyframe at time for object/property.
   * @param {string} objectId
   * @param {string} property
   * @param {number} time
   * @returns {boolean}
   */
  removeKeyframe(objectId, property, time) {
    const list = this._ensure(objectId, property)
    const index = list.findIndex(k => k.time === time)
    if (index === -1) return false
    list.splice(index, 1)
    return true
  }

  /**
   * Get keyframes for object/property.
   * @param {string} objectId
   * @param {string} property
   * @returns {Array}
   */
  getKeyframes(objectId, property) {
    const list = this._ensure(objectId, property)
    return list.map(k => ({ ...k }))
  }

  /**
   * Get all keyframes for object.
   * @param {string} objectId
   * @returns {object} map of property -> keyframes
   */
  getObjectKeyframes(objectId) {
    const map = this.keyframes.get(objectId)
    if (!map) return {}

    const result = {}
    map.forEach((list, property) => {
      result[property] = list.map(k => ({ ...k }))
    })
    return result
  }

  /**
   * Set full keyframe set for object.
   * @param {string} objectId
   * @param {object} data - property -> keyframes[]
   */
  setObjectKeyframes(objectId, data) {
    const map = new Map()
    Object.entries(data || {}).forEach(([property, list]) => {
      if (isArray(list)) {
        map.set(property, list.map(k => ({ ...k })))
      }
    })
    this.keyframes.set(objectId, map)
  }

  /**
   * Remove all keyframes for object.
   * @param {string} objectId
   */
  removeObject(objectId) {
    this.keyframes.delete(objectId)
  }

  /**
   * Sample value at time.
   * @param {string} objectId
   * @param {string} property
   * @param {number} time
   * @param {Function} interpolate - interpolation function (a, b, t, keyA, keyB)
   * @returns {number|object|null}
   */
  sample(objectId, property, time, interpolate) {
    const list = this._ensure(objectId, property)
    if (list.length === 0) return null

    if (time <= list[0].time) {
      return list[0].value
    }

    if (time >= list[list.length - 1].time) {
      return list[list.length - 1].value
    }

    for (let i = 0; i < list.length - 1; i++) {
      const current = list[i]
      const next = list[i + 1]
      if (time >= current.time && time <= next.time) {
        const span = next.time - current.time
        const t = span === 0 ? 0 : (time - current.time) / span
        if (typeof interpolate === 'function') {
          return interpolate(current.value, next.value, t, current, next)
        }
        return current.value
      }
    }

    return list[list.length - 1].value
  }
}
