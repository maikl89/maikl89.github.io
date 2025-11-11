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
    this.isPanning = false
    this.activePointerType = null
    this.dragHandle = null // { type: 'origin'|'anchor'|'start'|'end', index: number, objectId: string }
    this.lastX = 0
    this.lastY = 0
    this.lastMoveTime = 0
    this.pointerThrottleMs = 8 // Reduced for better responsiveness
    this.clickStartX = 0
    this.clickStartY = 0
    this.clickThreshold = 5 // pixels - if mouse moves more than this, it's a drag, not a click
    this.panStartViewBox = null // Store initial viewBox when panning starts

    // Pinch-to-zoom state
    this.isPinching = false
    this.initialPinchDistance = 0
    this.initialZoom = 1.0
    this.pinchCenterX = 0
    this.pinchCenterY = 0

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
      // Allow panning (scrolling) by default, but we'll preventDefault when dragging handles
      // 'manipulation' allows panning but disables double-tap zoom
      this.container.style.touchAction = 'manipulation'
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
    
    // Handle pinch-to-zoom (two fingers)
    if (e.touches.length === 2) {
      this.isPinching = true
      this.isDragging = false // Cancel any drag operation
      this.dragHandle = null
      
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      
      // Calculate initial distance
      const dx = touch2.clientX - touch1.clientX
      const dy = touch2.clientY - touch1.clientY
      this.initialPinchDistance = Math.sqrt(dx * dx + dy * dy)
      
      // Calculate center point
      this.pinchCenterX = (touch1.clientX + touch2.clientX) / 2
      this.pinchCenterY = (touch1.clientY + touch2.clientY) / 2
      
      // Request initial zoom from callback
      this.onUpdate({
        type: 'get-initial-zoom'
      })
      
      e.preventDefault()
      return
    }
    
    // Single touch - handle normally
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
    if (!target) return

    this.clickStartX = clientX
    this.clickStartY = clientY
    this.lastX = clientX
    this.lastY = clientY

    let shouldPreventDefault = false

    // Check for handle (not origin - handles are always draggable)
    const handleType = target.getAttribute?.('data-type')
    if (handleType && handleType !== 'origin' && target.hasAttribute?.('data-object-id')) {
      const objectId = target.getAttribute('data-object-id')
      // Request to check if object is locked - App.js will respond
      this.onUpdate({
        type: 'pointer-down-on-handle',
        handleType: handleType,
        objectId: objectId,
        index: parseInt(target.getAttribute('data-index') || '0', 10),
        event: event,
        clientX: clientX,
        clientY: clientY
      })
      shouldPreventDefault = true
      if (shouldPreventDefault) {
        event.preventDefault()
        event.stopPropagation()
      }
      return
    } else if (target.hasAttribute && target.hasAttribute('data-object')) {
      // Check for object (including draggable paths with origin type)
      const objectId = target.getAttribute('data-object')
      
      // Request to check if object is locked - App.js will handle the decision
      this.onUpdate({
        type: 'pointer-down-on-object',
        objectId: objectId,
        handleType: handleType,
        target: target,
        event: event,
        clientX: clientX,
        clientY: clientY
      })
      shouldPreventDefault = true
      return
    } else {
      // Clicked on empty SVG area - start panning
      this._startPanning(event, clientX, clientY)
      shouldPreventDefault = true
    }

    if (shouldPreventDefault) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  _startPanning(event, clientX, clientY) {
    // Only allow panning if zoomed in (zoom > 1.0)
    // Check zoom level by comparing viewBox width to base width
    const svg = this.container?.querySelector('svg')
    if (svg) {
      const viewBox = svg.viewBox?.baseVal
      if (viewBox) {
        // If viewBox width equals base width (1920), we're at 100% zoom - no panning
        const baseWidth = 1920
        const isZoomedIn = viewBox.width < baseWidth
        
        if (!isZoomedIn) {
          // Not zoomed in, don't start panning
          return
        }

        this.isPanning = true
        this.isDragging = false
        this.dragHandle = null

        this.panStartViewBox = {
          x: viewBox.x,
          y: viewBox.y,
          width: viewBox.width,
          height: viewBox.height
        }

        // Store initial pan position
        this.panStartX = clientX
        this.panStartY = clientY
      }
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
    
    // Handle pinch-to-zoom (two fingers)
    if (e.touches.length === 2 && this.isPinching) {
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      
      // Calculate current distance
      const dx = touch2.clientX - touch1.clientX
      const dy = touch2.clientY - touch1.clientY
      const currentDistance = Math.sqrt(dx * dx + dy * dy)
      
      // Calculate zoom factor
      const scale = currentDistance / this.initialPinchDistance
      const newZoom = this.initialZoom * scale
      
      // Calculate center point in SVG coordinates
      const svg = this.container?.querySelector('svg')
      if (svg) {
        const svgRect = svg.getBoundingClientRect()
        const viewBox = svg.viewBox?.baseVal
        if (viewBox) {
          // Convert screen coordinates to viewBox coordinates
          const relX = (this.pinchCenterX - svgRect.left) / svgRect.width
          const relY = (this.pinchCenterY - svgRect.top) / svgRect.height
          const centerX = viewBox.x + (relX * viewBox.width)
          const centerY = viewBox.y + (relY * viewBox.height)
          
          // Notify about zoom
          this.onUpdate({
            type: 'zoom',
            zoom: newZoom,
            centerX: centerX,
            centerY: centerY
          })
        }
      }
      
      e.preventDefault()
      return
    }
    
    // Single touch - handle normally (but not if we were pinching)
    if (!this.isPinching && e.touches.length === 1) {
      const touch = e.touches[0]
      this._handlePointerMove({
        event: e,
        clientX: touch.clientX,
        clientY: touch.clientY
      })
    }
  }

  _handlePointerMove({ event, clientX, clientY }) {
    // Handle panning
    if (this.isPanning && this.panStartViewBox) {
      const dx = clientX - this.panStartX
      const dy = clientY - this.panStartY

      // Convert screen delta to viewBox delta
      const svg = this.container?.querySelector('svg')
      if (svg) {
        const svgRect = svg.getBoundingClientRect()
        const viewBox = svg.viewBox?.baseVal
        if (viewBox && svgRect.width > 0 && svgRect.height > 0) {
          // Calculate scale factor
          const scaleX = viewBox.width / svgRect.width
          const scaleY = viewBox.height / svgRect.height

          // Calculate new viewBox position
          const newX = this.panStartViewBox.x - (dx * scaleX)
          const newY = this.panStartViewBox.y - (dy * scaleY)

          // Clamp to bounds (can't pan beyond base viewBox)
          // Get base dimensions from SVG renderer if available
          const baseWidth = 1920 // Base viewBox width
          const baseHeight = 1080 // Base viewBox height
          const maxX = Math.max(0, baseWidth - viewBox.width)
          const maxY = Math.max(0, baseHeight - viewBox.height)

          const clampedX = Math.max(0, Math.min(maxX, newX))
          const clampedY = Math.max(0, Math.min(maxY, newY))

          // Notify about pan
          this.onUpdate({
            type: 'pan',
            viewBox: {
              x: clampedX,
              y: clampedY,
              width: viewBox.width,
              height: viewBox.height
            }
          })
        }
      }

      if (this.activePointerType === 'touch') {
        event.preventDefault()
      }
      return
    }

    // Handle object/handle dragging
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
    // Handle pinch end
    if (this.isPinching && e.touches.length < 2) {
      this.isPinching = false
      this.initialPinchDistance = 0
      this.initialZoom = 1.0
      return
    }
    
    // handle specially for touch events
    if (this.isDragging) {
      // this.isDragging = false
      // this.dragHandle = null
      // this.activePointerType = null
      this.onUpdate({
        type: 'drag-end'
      })
    }
  }

  _handlePointerUp(e) {
    if (this.isPanning) {
      this.isPanning = false
      this.panStartViewBox = null
      this.panStartX = 0
      this.panStartY = 0
    }

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

  reset() {
    this.isDragging = false
    this.isPanning = false
    this.dragHandle = null
    this.activePointerType = null
    this.panStartViewBox = null
  }

  destroy() {
    this._detachListeners()
    this.container = null
    this.onUpdate = null
  }
}

