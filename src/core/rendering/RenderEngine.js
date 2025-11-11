/**
 * Render Engine - Base class for rendering systems
 * Provides common rendering functionality and lifecycle management.
 */

import DEFAULT_CONFIG from '../../app/config.js'

export class RenderEngine {
  /**
   * Create a render engine.
   * @param {HTMLElement} container - Container element for rendering
   * @param {object} options - Render options
   */
  constructor(container, options = {}) {
    if (!container) {
      throw new Error('Container element is required')
    }
    
    this.container = container
    this.options = {
      // Container dimensions (for sizing the render target)
      width: options.width || 800,
      height: options.height || 600,
      // ViewBox dimensions (for SVG coordinate system, from config)
      viewBoxWidth: options.viewBoxWidth || DEFAULT_CONFIG.stage?.width || 1920,
      viewBoxHeight: options.viewBoxHeight || DEFAULT_CONFIG.stage?.height || 1080,
      ...options
    }
    
    this.isRendering = false
    this.needsRender = false
    this.frameId = null
  }

  /**
   * Initialize the render engine.
   * Must be implemented by subclasses.
   */
  init() {
    throw new Error('init() must be implemented by subclass')
  }

  /**
   * Render a frame.
   * Must be implemented by subclasses.
   * @param {object} scene - Scene data to render
   */
  render(scene) {
    throw new Error('render() must be implemented by subclass')
  }

  /**
   * Request a render (schedules render on next frame).
   * @param {object} scene - Scene data to render
   */
  requestRender(scene) {
    this.needsRender = true
    this.pendingScene = scene
    
    if (!this.isRendering) {
      this._startRenderLoop()
    }
  }

  /**
   * Start the render loop.
   * @private
   */
  _startRenderLoop() {
    if (this.isRendering) return
    
    this.isRendering = true
    
    const renderFrame = () => {
      if (this.needsRender && this.pendingScene) {
        this.render(this.pendingScene)
        this.needsRender = false
      }
      
      this.frameId = requestAnimationFrame(renderFrame)
    }
    
    renderFrame()
  }

  /**
   * Stop the render loop.
   */
  stop() {
    this.isRendering = false
    this.needsRender = false
    
    if (this.frameId) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
  }

  /**
   * Resize the render target.
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    this.options.width = width
    this.options.height = height
    this.needsRender = true
  }

  /**
   * Clean up resources.
   */
  destroy() {
    this.stop()
    this.container = null
  }
}

