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
    this.activePointerType = null
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
    this._originalTouchAction = null

    this._boundHandlers = {
      mousedown: this._onMouseDown.bind(this),
      mousemove: this._onMouseMove.bind(this),
      mouseup: this._onMouseUp.bind(this),
      mouseleave: this._onMouseUp.bind(this),
      touchstart: this._onTouchStart.bind(this),
      touchmove: this._onTouchMove.bind(this),
      touchend: this._onTouchEnd.bind(this),
      touchcancel: this._onTouchEnd.bind(this)
    }

    this._attachListeners()
  }

  _attachListeners() {
    if (!this.container) return

    if (this.container instanceof HTMLElement) {
      this._originalTouchAction = this.container.style.touchAction
      this.container.style.touchAction = 'none'
    }

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

    if (this.container instanceof HTMLElement && this._originalTouchAction !== null) {
      this.container.style.touchAction = this._originalTouchAction
      this._originalTouchAction = null
    }
  }

  setCamera(camera) {
    this.camera = { ...camera }
  }

  setRotation(rotation) {
    this.rotation = { ...rotation }
  }

  _onMouseDown(e) {
    this.activePointerType = 'mouse'
    this._handlePointerDown({
      event: e,
      target: e.target,
      clientX: e.clientX,
      clientY: e.clientY
    })
  }

  _onTouchStart(e) {
    if (e.touches.length === 0) return
    const touch = e.touches[0]
    this.activePointerType = 'touch'
    this._handlePointerDown({
      event: e,
      target: e.target,
      clientX: touch.clientX,
      clientY: touch.clientY
    })
  }

  _handlePointerDown({ event, target, clientX, clientY }) {
    if (!target || !target.hasAttribute) return

    this.clickStartX = clientX
    this.clickStartY = clientY
    this.lastX = clientX
    this.lastY = clientY

    let shouldPreventDefault = false

    // Check for handle (not origin - handles are always draggable)
    const handleType = target.getAttribute('data-type')
    if (handleType && handleType !== 'origin' && target.hasAttribute('data-object-id')) {
      this.isDragging = true
      this.dragHandle = {
        type: handleType,
        index: parseInt(target.getAttribute('data-index') || '0', 10),
        objectId: target.getAttribute('data-object-id')
      }
      shouldPreventDefault = true
      if (shouldPreventDefault) {
        event.preventDefault()
        event.stopPropagation()
      }
      return
    } else if (target.hasAttribute('data-object')) {
      // Check for object (including draggable paths with origin type)
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

      // Always select the object when interacting with it
      this.onUpdate({
        type: 'select',
        objectId: objectId
      })

      shouldPreventDefault = true
    }

    if (shouldPreventDefault) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  _onMouseMove(e) {
    this._handlePointerMove({
      event: e,
      clientX: e.clientX,
      clientY: e.clientY
    })
  }

  _onTouchMove(e) {
    if (e.touches.length === 0) return
    const touch = e.touches[0]
    this._handlePointerMove({
      event: e,
      clientX: touch.clientX,
      clientY: touch.clientY
    })
  }

  _handlePointerMove({ event, clientX, clientY }) {
    if (!this.isDragging || !this.dragHandle) return

    // Calculate delta from last processed position
    const dx = clientX - this.lastX
    const dy = clientY - this.lastY

    // No throttling for drag operations - process immediately for smooth dragging
    const svgDelta = this._computeSvgDelta(dx, dy)
    // Convert SVG coordinates to world coordinates (accounting for camera scale)
    const worldDelta = this._toWorldDelta(svgDelta.dx, svgDelta.dy)

    this.onUpdate({
      type: 'drag',
      handle: this.dragHandle,
      delta: worldDelta
    })

    if (this.activePointerType === 'touch') {
      event.preventDefault()
    }

    // Update last processed position immediately
    this.lastX = clientX
    this.lastY = clientY
  }

  _onMouseUp(e) {
    this._handlePointerUp(e)
  }

  _onTouchEnd(e) {
    this._handlePointerUp(e)
  }

  _handlePointerUp(e) {
    if (this.isDragging) {
      this.isDragging = false
      this.dragHandle = null
      this.activePointerType = null

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

