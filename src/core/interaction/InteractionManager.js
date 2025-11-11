/**
 * Interaction Manager - Handles mouse/touch interactions for canvas editing
 * Supports dragging handles, moving objects, and rotation gestures
 */

import { degToRad } from '../../utils/math.js'

export class InteractionManager {
  constructor({ container, onUpdate = () => {} }) {
    this.container = container
    this.onUpdate = onUpdate

    this.isDragging = false
    this.dragHandle = null // { type: 'origin'|'anchor'|'start'|'end', index: number, objectId: string }
    this.lastX = 0
    this.lastY = 0
    this.lastMoveTime = 0
    this.pointerThrottleMs = 8 // Reduced for better responsiveness
    this.clickStartX = 0
    this.clickStartY = 0
    this.clickThreshold = 5 // pixels - if mouse moves more than this, it's a drag, not a click

    this.camera = { x: 0, y: 0, z: 200 }
    this.rotation = { x: 0, y: 0, z: 0 }

    this._boundHandlers = {
      mousedown: this._onMouseDown.bind(this),
      mousemove: this._onMouseMove.bind(this),
      mouseup: this._onMouseUp.bind(this),
      mouseleave: this._onMouseUp.bind(this)
    }

    this._attachListeners()
  }

  _attachListeners() {
    if (!this.container) return

    // Attach to container, but we'll find the SVG element in handlers
    Object.entries(this._boundHandlers).forEach(([event, handler]) => {
      this.container.addEventListener(event, handler, { passive: false })
    })
  }

  _detachListeners() {
    if (!this.container) return

    Object.entries(this._boundHandlers).forEach(([event, handler]) => {
      this.container.removeEventListener(event, handler)
    })
  }

  setCamera(camera) {
    this.camera = { ...camera }
  }

  setRotation(rotation) {
    this.rotation = { ...rotation }
  }

  _onMouseDown(e) {
    const target = e.target
    if (!target || !target.hasAttribute) return

    this.clickStartX = e.clientX
    this.clickStartY = e.clientY
    this.lastX = e.clientX
    this.lastY = e.clientY

    // Check for handle (not origin - handles are always draggable)
    const handleType = target.getAttribute('data-type')
    if (handleType && handleType !== 'origin' && target.hasAttribute('data-object-id')) {
      this.isDragging = true
      this.dragHandle = {
        type: handleType,
        index: parseInt(target.getAttribute('data-index') || '0', 10),
        objectId: target.getAttribute('data-object-id')
      }
      e.preventDefault()
      e.stopPropagation()
      return
    }

    // Check for object (including draggable paths with origin type)
    if (target.hasAttribute('data-object')) {
      const objectId = target.getAttribute('data-object')
      
      // If it's a draggable path (has data-type='origin'), prepare for drag
      if (handleType === 'origin' && target.hasAttribute('data-object-id')) {
        this.isDragging = true
        this.dragHandle = {
          type: 'origin',
          index: parseInt(target.getAttribute('data-index') || '0', 10),
          objectId: objectId
        }
      }
      
      // Always select the object when clicking on it
      this.onUpdate({
        type: 'select',
        objectId: objectId
      })
      
      e.preventDefault()
      e.stopPropagation()
    }
  }

  _onMouseMove(e) {
    if (!this.isDragging || !this.dragHandle) return

    // Calculate delta from last processed position
    const dx = e.clientX - this.lastX
    const dy = e.clientY - this.lastY

    // No throttling for drag operations - process immediately for smooth dragging
    const svgDelta = this._computeSvgDelta(dx, dy)
    // Convert SVG coordinates to world coordinates (accounting for camera scale)
    const worldDelta = this._toWorldDelta(svgDelta.dx, svgDelta.dy)

    this.onUpdate({
      type: 'drag',
      handle: this.dragHandle,
      delta: worldDelta
    })

    // Update last processed position immediately
    this.lastX = e.clientX
    this.lastY = e.clientY
  }

  _onMouseUp(e) {
    if (this.isDragging) {
      this.isDragging = false
      this.dragHandle = null

      this.onUpdate({
        type: 'drag-end'
      })
    }
  }

  _computeSvgDelta(dx, dy) {
    if (!this.container) return { dx: 0, dy: 0 }

    const svg = this.container.querySelector('svg')
    if (!svg) return { dx: 0, dy: 0 }

    const svgRect = svg.getBoundingClientRect()
    const viewBox = svg.viewBox?.baseVal

    if (!viewBox || viewBox.width === 0 || viewBox.height === 0) {
      // Fallback: use SVG dimensions directly
      const svgWidth = svg.getAttribute('width') || svgRect.width || 1
      const svgHeight = svg.getAttribute('height') || svgRect.height || 1
      return {
        dx: dx * (parseFloat(svgWidth) / svgRect.width || 1),
        dy: dy * (parseFloat(svgHeight) / svgRect.height || 1)
      }
    }

    // Calculate scale from viewBox to actual rendered size
    // With preserveAspectRatio="meet", the content is scaled uniformly
    const rectW = svgRect.width || 1
    const rectH = svgRect.height || 1
    const vbW = viewBox.width || 1
    const vbH = viewBox.height || 1

    // Calculate uniform scale for "meet" (content fits within viewport)
    const scaleX = vbW / rectW
    const scaleY = vbH / rectH
    const uniformScale = Math.min(scaleX, scaleY)

    // Calculate actual content size (may be smaller than container due to aspect ratio)
    const contentW = vbW / uniformScale
    const contentH = vbH / uniformScale

    // Calculate offset if content doesn't fill container (letterboxing/pillarboxing)
    const offsetX = (rectW - contentW) / 2
    const offsetY = (rectH - contentH) / 2

    // Convert screen delta to viewBox coordinates
    // Account for the actual content area, not the full container
    return {
      dx: dx * uniformScale,
      dy: dy * uniformScale
    }
  }

  _toWorldDelta(svgDx, svgDy) {
    // Account for camera zoom/scale
    // The SVG transform applies scale(200 / camera.z), so we need to convert
    // SVG viewBox coordinates to world coordinates by dividing by the camera scale
    const baseZ = 200
    const currentZ = this.camera.z || baseZ
    const cameraScale = baseZ / currentZ

    // Since objects are transformed with scale(cameraScale) in SVG,
    // we need to divide by cameraScale to get world coordinate delta
    return {
      x: svgDx / cameraScale,
      y: svgDy / cameraScale,
      z: 0
    }
  }

  destroy() {
    this._detachListeners()
    this.container = null
    this.onUpdate = null
  }
}

