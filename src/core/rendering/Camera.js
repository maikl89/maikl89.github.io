/**
 * Camera - Manages viewport transform and zoom
 * Provides camera positioning and zoom functionality.
 */

import { clamp } from '../../utils/math.js'

export class Camera {
  /**
   * Create a camera.
   * @param {object} options - Camera options
   */
  constructor(options = {}) {
    this.x = options.x || 0
    this.y = options.y || 0
    this.z = options.z || 200 // Z represents zoom (200 = 100%)
    
    this.minZoom = options.minZoom || -50
    this.maxZoom = options.maxZoom || 2000
    this.zoomStep = options.zoomStep || 50
    this.wheelZoomScale = options.wheelZoomScale || 4
    
    // Rotation (for 3D view)
    this.rotation = {
      x: options.rotation?.x || 0,
      y: options.rotation?.y || 0,
      z: options.rotation?.z || 0
    }
  }

  /**
   * Get current camera state.
   * @returns {object} Camera state
   */
  getState() {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      rotation: { ...this.rotation }
    }
  }

  /**
   * Set camera position.
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  setPosition(x, y) {
    this.x = x
    this.y = y
  }

  /**
   * Move camera by offset.
   * @param {number} dx - X offset
   * @param {number} dy - Y offset
   */
  move(dx, dy) {
    this.x += dx
    this.y += dy
  }

  /**
   * Set zoom level.
   * @param {number} z - Zoom level (200 = 100%)
   */
  setZoom(z) {
    this.z = clamp(z, this.minZoom, this.maxZoom)
  }

  /**
   * Zoom in.
   * @param {number} amount - Zoom amount (default: zoomStep)
   */
  zoomIn(amount = null) {
    const step = amount || this.zoomStep
    this.setZoom(this.z - step)
  }

  /**
   * Zoom out.
   * @param {number} amount - Zoom amount (default: zoomStep)
   */
  zoomOut(amount = null) {
    const step = amount || this.zoomStep
    this.setZoom(this.z + step)
  }

  /**
   * Zoom using mouse wheel.
   * @param {number} delta - Wheel delta (positive = zoom in, negative = zoom out)
   */
  zoomWheel(delta) {
    const zoomDelta = delta * this.wheelZoomScale
    this.setZoom(this.z - zoomDelta)
  }

  /**
   * Get zoom scale factor (1.0 = 100%).
   * @returns {number} Scale factor
   */
  getScale() {
    return this.z > 0 ? 200 / this.z : 1
  }

  /**
   * Reset camera to default position.
   */
  reset() {
    this.x = 0
    this.y = 0
    this.z = 200
    this.rotation = { x: 0, y: 0, z: 0 }
  }

  /**
   * Set rotation.
   * @param {number} x - X rotation (radians)
   * @param {number} y - Y rotation (radians)
   * @param {number} z - Z rotation (radians)
   */
  setRotation(x, y, z) {
    this.rotation.x = x
    this.rotation.y = y
    this.rotation.z = z
  }

  /**
   * Rotate camera.
   * @param {number} dx - X rotation delta
   * @param {number} dy - Y rotation delta
   * @param {number} dz - Z rotation delta
   */
  rotate(dx, dy, dz) {
    this.rotation.x += dx
    this.rotation.y += dy
    this.rotation.z += dz
  }
}

