/**
 * Canvas Renderer - Renders objects on HTML5 Canvas
 * Extends RenderEngine to provide canvas-based rendering.
 */

import { RenderEngine } from './RenderEngine.js'

export class CanvasRenderer extends RenderEngine {
  /**
   * Create a canvas renderer.
   * @param {HTMLElement} container - Container element
   * @param {object} options - Render options
   */
  constructor(container, options = {}) {
    super(container, options)
    this.canvas = null
    this.ctx = null
  }

  /**
   * Initialize the canvas renderer.
   */
  init() {
    // Create canvas element
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.options.width
    this.canvas.height = this.options.height
    this.canvas.style.display = 'block'
    
    // Get 2D context
    this.ctx = this.canvas.getContext('2d')
    if (!this.ctx) {
      throw new Error('Could not get 2D rendering context')
    }
    
    // Clear container and append canvas
    this.container.innerHTML = ''
    this.container.appendChild(this.canvas)
  }

  /**
   * Render scene to canvas.
   * @param {object} scene - Scene data with objects array
   */
  render(scene) {
    if (!this.canvas || !this.ctx) {
      this.init()
    }
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    
    if (!scene || !scene.objects || !Array.isArray(scene.objects)) {
      return
    }
    
    // Save context state
    this.ctx.save()
    
    // Apply camera transform
    const camera = scene.camera || { x: 0, y: 0, z: 200 }
    const scale = camera.z ? 200 / camera.z : 1
    this.ctx.translate(camera.x || 0, camera.y || 0)
    this.ctx.scale(scale, scale)
    
    // Render each object
    scene.objects.forEach(obj => {
      this._renderObject(obj)
    })
    
    // Restore context state
    this.ctx.restore()
  }

  /**
   * Render a single object.
   * @param {object} obj - Object to render
   * @private
   */
  _renderObject(obj) {
    if (!obj || !obj.nodes || !Array.isArray(obj.nodes)) {
      return
    }
    
    this.ctx.save()
    
    // Apply object transform
    if (obj.offset) {
      this.ctx.translate(obj.offset.x || 0, obj.offset.y || 0)
    }
    
    if (obj.rotate) {
      const angle = obj.rotate.z || 0
      this.ctx.rotate(angle)
    }
    
    // Set styles
    this.ctx.fillStyle = obj.fill || 'transparent'
    this.ctx.strokeStyle = obj.stroke || '#000'
    this.ctx.lineWidth = obj.strokeWidth || 1
    this.ctx.globalAlpha = obj.opacity !== undefined ? obj.opacity : 1
    
    // Render based on type
    if (obj.svg_element === 'path' && obj.nodes.length >= 2) {
      this._renderPath(obj)
    } else if (obj.svg_element === 'circle') {
      this._renderCircle(obj)
    } else if (obj.svg_element === 'rect') {
      this._renderRect(obj)
    }
    
    this.ctx.restore()
  }

  /**
   * Render object as path.
   * @param {object} obj - Object with nodes
   * @private
   */
  _renderPath(obj) {
    const nodes = obj.nodes || []
    if (nodes.length === 0) return
    
    this.ctx.beginPath()
    
    // Move to first point
    const first = nodes[0]
    this.ctx.moveTo(first.x, first.y)
    
    // Draw lines or curves
    for (let i = 1; i < nodes.length; i++) {
      const node = nodes[i]
      
      if (node.start && node.end) {
        // Bezier curve
        this.ctx.bezierCurveTo(
          node.start.x, node.start.y,
          node.end.x, node.end.y,
          node.x, node.y
        )
      } else {
        // Straight line
        this.ctx.lineTo(node.x, node.y)
      }
    }
    
    // Close path if needed
    if (obj.closed !== false && nodes.length > 2) {
      this.ctx.closePath()
    }
    
    // Fill and stroke
    if (obj.fill && obj.fill !== 'none' && obj.fill !== 'transparent') {
      this.ctx.fill()
    }
    if (obj.stroke && obj.stroke !== 'none') {
      this.ctx.stroke()
    }
  }

  /**
   * Render object as circle.
   * @param {object} obj - Object data
   * @private
   */
  _renderCircle(obj) {
    const center = obj.nodes && obj.nodes[0] ? obj.nodes[0] : { x: 0, y: 0 }
    const radius = obj.radius || 10
    
    this.ctx.beginPath()
    this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
    
    if (obj.fill && obj.fill !== 'none' && obj.fill !== 'transparent') {
      this.ctx.fill()
    }
    if (obj.stroke && obj.stroke !== 'none') {
      this.ctx.stroke()
    }
  }

  /**
   * Render object as rect.
   * @param {object} obj - Object data
   * @private
   */
  _renderRect(obj) {
    const first = obj.nodes && obj.nodes[0] ? obj.nodes[0] : { x: 0, y: 0 }
    const width = obj.width || 10
    const height = obj.height || 10
    
    this.ctx.fillRect(first.x - width / 2, first.y - height / 2, width, height)
    
    if (obj.stroke && obj.stroke !== 'none') {
      this.ctx.strokeRect(first.x - width / 2, first.y - height / 2, width, height)
    }
  }

  /**
   * Resize the canvas renderer.
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    super.resize(width, height)
    if (this.canvas) {
      this.canvas.width = width
      this.canvas.height = height
    }
  }
}

