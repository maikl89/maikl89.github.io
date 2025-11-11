/**
 * AnimationEngine - Core animation playback controller
 * Manages timeline progression, playback state, and animator execution.
 */

import { clamp } from '../../utils/math.js'

export class AnimationEngine {
  /**
   * Create an animation engine.
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.duration = options.duration || 3000
    this.loop = options.loop || false
    this.playbackRate = options.playbackRate || 1

    this.currentTime = 0
    this.isPlaying = false
    this.lastTimestamp = null
    this.rafId = null

    this.animators = new Map() // Map<objectId, animator[]>
    this.listeners = new Set()
  }

  /**
   * Register a listener for animation events.
   * @param {Function} callback - Receives { type, payload }
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Notify listeners of an event.
   * @param {string} type - Event type
   * @param {object} payload - Event payload
   * @private
   */
  _emit(type, payload = {}) {
    this.listeners.forEach(listener => {
      try {
        listener({ type, payload })
      } catch (error) {
        console.warn('Animation listener error:', error)
      }
    })
  }

  /**
   * Register animators for a specific object.
   * @param {string} objectId - Object identifier
   * @param {Array} animatorList - Array of animator descriptors
   */
  registerAnimators(objectId, animatorList) {
    this.animators.set(objectId, animatorList)
  }

  /**
   * Remove animators for an object.
   * @param {string} objectId - Object identifier
   */
  removeAnimators(objectId) {
    this.animators.delete(objectId)
  }

  /**
   * Clear all animators.
   */
  clearAnimators() {
    this.animators.clear()
  }

  /**
   * Play animation from current position.
   */
  play() {
    if (this.isPlaying) return

    this.isPlaying = true
    this.lastTimestamp = null
    this._emit('play')
    this._requestFrame()
  }

  /**
   * Pause animation.
   */
  pause() {
    if (!this.isPlaying) return

    this.isPlaying = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this._emit('pause')
  }

  /**
   * Stop animation and reset to start.
   */
  stop() {
    this.pause()
    this.seek(0)
    this._emit('stop')
  }

  /**
   * Seek to specific time.
   * @param {number} time - Time in milliseconds
   */
  seek(time) {
    this.currentTime = clamp(time, 0, this.duration)
    this._applyAnimators(this.currentTime)
    this._emit('seek', { time: this.currentTime })
  }

  /**
   * Set animation duration.
   * @param {number} duration - Duration in milliseconds
   */
  setDuration(duration) {
    this.duration = Math.max(0, duration)
    this.currentTime = clamp(this.currentTime, 0, this.duration)
  }

  /**
   * Set playback rate.
   * @param {number} rate - Playback speed (1 = normal)
   */
  setPlaybackRate(rate) {
    this.playbackRate = rate || 1
  }

  /**
   * Request animation frame loop.
   * @private
   */
  _requestFrame() {
    this.rafId = requestAnimationFrame(timestamp => this._update(timestamp))
  }

  /**
   * Update loop called by requestAnimationFrame.
   * @param {DOMHighResTimeStamp} timestamp
   * @private
   */
  _update(timestamp) {
    if (!this.isPlaying) return

    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp
    }

    const delta = (timestamp - this.lastTimestamp) * this.playbackRate
    this.lastTimestamp = timestamp

    this.currentTime += delta

    if (this.currentTime >= this.duration) {
      if (this.loop) {
        this.currentTime = this.currentTime % this.duration
        this._emit('loop')
      } else {
        this.currentTime = this.duration
        this._applyAnimators(this.currentTime)
        this._emit('update', { time: this.currentTime })
        this._emit('finish')
        this.pause()
        return
      }
    }

    this._applyAnimators(this.currentTime)
    this._emit('update', { time: this.currentTime })
    this._requestFrame()
  }

  /**
   * Apply animators to their target objects.
   * @param {number} time - Current time in milliseconds
   * @private
   */
  _applyAnimators(time) {
    this.animators.forEach(animatorList => {
      animatorList.forEach(animator => {
        try {
          animator.update(time)
        } catch (error) {
          console.warn('Animator update failed:', error)
        }
      })
    })
  }
}
