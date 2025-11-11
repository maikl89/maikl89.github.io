/**
 * SVG Renderer - Renders objects as SVG elements
 * Extends RenderEngine to provide SVG-based rendering.
 */

import { RenderEngine } from './RenderEngine.js'
import DEFAULT_CONFIG from '../../app/config.js'

export class SVGRenderer extends RenderEngine {
  /**
   * Create an SVG renderer.
   * @param {HTMLElement} container - Container element
   * @param {object} options - Render options
   */
  constructor(container, options = {}) {
    super(container, options)
    this.svg = null
    this.defs = null
    this.objectsLayer = null
    this.controlsLayer = null
    this.showControls = true
    this.controlsConfig =
      options.controls ||
      (options.config && options.config.controls) ||
      DEFAULT_CONFIG.controls
  }

  /**
   * Initialize the SVG renderer.
   */
  init() {
    // Create SVG element
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    
    // Set fixed viewBox using config values from RenderEngine options
    const viewBoxWidth = this.options.viewBoxWidth
    const viewBoxHeight = this.options.viewBoxHeight
    this.svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`)
    
    // Set fixed pixel dimensions (like original preview)
    this.svg.setAttribute('width', viewBoxWidth)
    this.svg.setAttribute('height', viewBoxHeight)
    
    // Preserve aspect ratio - this makes SVG scale to fit container
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    
    this.svg.style.display = 'block'
    this.svg.style.width = '100%'
    this.svg.style.height = '100%'
    
    // Create defs for reusable elements (gradients, filters, etc.)
    this.defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    this.svg.appendChild(this.defs)

    // Create layers
    this.objectsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    this.objectsLayer.setAttribute('class', 'objects-layer')
    this.svg.appendChild(this.objectsLayer)

    this.controlsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    this.controlsLayer.setAttribute('class', 'controls-layer')
    this.controlsLayer.setAttribute('vector-effect', 'non-scaling-stroke')
    this.svg.appendChild(this.controlsLayer)
    
    // Clear container and append SVG
    this.container.innerHTML = ''
    this.container.appendChild(this.svg)
  }

  /**
   * Recursively find an object in the scene (including nested in groups).
   * @param {Array} objects - Array of objects to search
   * @param {string} objectId - ID to find
   * @returns {object|null} Found object or null
   * @private
   */
  _findObjectInScene(objects, objectId) {
    if (!objects || !Array.isArray(objects)) return null
    
    for (const obj of objects) {
      if (obj.id === objectId) {
        return obj
      }
      
      // If it's a group, search in children
      if ((obj.type === 'group' || obj.svg_element === 'g') && Array.isArray(obj.children)) {
        const found = this._findObjectInScene(obj.children, objectId)
        if (found) {
          return found
        }
      }
    }
    
    return null
  }

  /**
   * Calculate accumulated transform for a nested object (including all parent groups).
   * @param {Array} objects - Array of top-level objects
   * @param {string} objectId - ID of the object
   * @param {object} camera - Camera transform
   * @returns {object} Accumulated transform { x, y, scale }
   * @private
   */
  _calculateAccumulatedTransform(objects, objectId, camera) {
    const findObjectAndParents = (objs, targetId, parents = []) => {
      for (const obj of objs) {
        if (obj.id === targetId) {
          return { object: obj, parents }
        }
        
        if ((obj.type === 'group' || obj.svg_element === 'g') && Array.isArray(obj.children)) {
          const found = findObjectAndParents(obj.children, targetId, [...parents, obj])
          if (found) {
            return found
          }
        }
      }
      return null
    }
    
    const result = findObjectAndParents(objects, objectId)
    if (!result) {
      // Not found, return object's own transform
      return { x: 0, y: 0, scale: 1 }
    }
    
    const { object, parents } = result
    
    // Accumulate transforms from all parents
    let x = (object.offset?.x || 0) + (camera.x || 0)
    let y = (object.offset?.y || 0) + (camera.y || 0)
    const scale = camera.z ? 200 / camera.z : 1
    
    // Add parent group transforms
    for (const parent of parents) {
      x += parent.offset?.x || 0
      y += parent.offset?.y || 0
    }
    
    return { x, y, scale }
  }

  /**
   * Render scene to SVG.
   * @param {object} scene - Scene data with objects array
   */
  render(scene) {
    if (!this.svg) {
      this.init()
    }
    
    // Clear existing content (except defs and layers)
    if (this.objectsLayer) {
      this.objectsLayer.innerHTML = ''
    }
    if (this.controlsLayer) {
      this.controlsLayer.innerHTML = ''
    }
    
    if (!scene || !scene.objects || !Array.isArray(scene.objects)) {
      return
    }
    
    const selectedId = scene?.selectedId || null

    scene.objects.forEach(obj => {
      const group = this._renderObject(obj, scene.camera, selectedId && obj.id === selectedId, selectedId)
      if (group) {
        this.objectsLayer.appendChild(group)
      }

      // Render controls for selected object (top-level only, nested objects handled below)
      if (this.showControls && selectedId && obj.id === selectedId) {
        const controls = this._renderControls(obj, scene.camera)
        if (controls) {
          this.controlsLayer.appendChild(controls)
        }
      }
    })

    // Render controls for nested selected objects
    if (this.showControls && selectedId) {
      const selectedObj = this._findObjectInScene(scene.objects, selectedId)
      if (selectedObj) {
        // Check if it's not a top-level object (already rendered above)
        const isTopLevel = scene.objects.some(obj => obj.id === selectedId)
        if (!isTopLevel) {
          // Calculate accumulated transform for nested object
          const accumulatedTransform = this._calculateAccumulatedTransform(scene.objects, selectedId, scene.camera)
          const controls = this._renderControls(selectedObj, scene.camera, accumulatedTransform)
          if (controls) {
            this.controlsLayer.appendChild(controls)
          }
        }
      }
    }
  }

  /**
   * Render a single object.
   * @param {object} obj - Object to render
   * @param {object} camera - Camera transform
   * @returns {SVGGElement|null} SVG group element
   * @private
   */
  _renderObject(obj, camera = { x: 0, y: 0, z: 200 }, isSelected = false, selectedId = null) {
    if (!obj) {
      return null
    }
    
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('data-object', obj.id || 'unknown')
    if (isSelected) {
      group.setAttribute('data-selected', 'true')
    }
    
    // Apply object transform
    const x = (obj.offset?.x || 0) + (camera.x || 0)
    const y = (obj.offset?.y || 0) + (camera.y || 0)
    const scale = camera.z ? 200 / camera.z : 1
    
    group.setAttribute('transform', `translate(${x}, ${y}) scale(${scale})`)
    
    // Handle group type - recursively render children
    if (obj.type === 'group' || obj.svg_element === 'g') {
      const children = obj.children || []
      children.forEach(child => {
        const childIsSelected = selectedId && child.id === selectedId
        const childGroup = this._renderObject(child, { x: 0, y: 0, z: camera.z }, childIsSelected, selectedId)
        if (childGroup) {
          group.appendChild(childGroup)
        }
      })
      
      // Make group selectable and draggable
      group.style.cursor = 'pointer'
      
      // Add a transparent rect for easier clicking on empty group areas
      if (children.length > 0) {
        const bounds = this._calculateGroupBounds(children)
        if (bounds) {
          const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          hitArea.setAttribute('x', bounds.minX - 10)
          hitArea.setAttribute('y', bounds.minY - 10)
          hitArea.setAttribute('width', bounds.width + 20)
          hitArea.setAttribute('height', bounds.height + 20)
          hitArea.setAttribute('fill', 'transparent')
          hitArea.setAttribute('stroke', 'none')
          hitArea.setAttribute('data-object', String(obj.id))
          // Make filled hit area draggable for origin movement
          hitArea.setAttribute('data-type', 'origin')
          hitArea.setAttribute('data-object-id', String(obj.id))
          hitArea.setAttribute('data-index', '0')
          hitArea.style.cursor = 'move'
          hitArea.style.pointerEvents = 'all'
          group.insertBefore(hitArea, group.firstChild)
        }
      }
      
      return group
    }
    
    // Regular objects need nodes
    if (!obj.nodes || !Array.isArray(obj.nodes)) {
      return null
    }
    
    // Render based on SVG element type
    if (obj.svg_element === 'path' && obj.nodes.length >= 2) {
      const path = this._renderPath(obj)
      if (path) {
        // Add data-object for click selection
        path.setAttribute('data-object', String(obj.id))
        
        if (isSelected) {
          const outline = path.cloneNode(true)
          outline.setAttribute('fill', 'none')
          const strokeWidth = Number(path.getAttribute('stroke-width') || 1)
          outline.setAttribute('stroke-width', strokeWidth + 2)
          outline.setAttribute('stroke', '#3b82f6')
          outline.setAttribute('opacity', '0.45')
          outline.setAttribute('pointer-events', 'none')
          group.appendChild(outline)
        }

        // Make filled paths draggable for origin movement
        const fillValue = (obj.fill || '').toLowerCase()
        const isDraggableFill = fillValue !== 'none' && fillValue !== 'transparent' && (obj.opacity ?? 1) !== 0
        if (isDraggableFill) {
          path.setAttribute('data-type', 'origin')
          path.setAttribute('data-object-id', String(obj.id))
          path.setAttribute('data-index', '0')
          path.style.cursor = 'move'
        } else {
          // Non-filled paths should still be clickable for selection
          path.style.cursor = 'pointer'
        }

        group.appendChild(path)
      }
    } else if (obj.svg_element === 'circle') {
      const circle = this._renderCircle(obj)
      if (circle) {
        // Add data-object for click selection
        circle.setAttribute('data-object', String(obj.id))
        circle.style.cursor = 'pointer'
        
        if (isSelected) {
          const outline = circle.cloneNode(true)
          const strokeWidth = Number(circle.getAttribute('stroke-width') || 1)
          outline.setAttribute('fill', 'none')
          outline.setAttribute('stroke-width', strokeWidth + 2)
          outline.setAttribute('stroke', '#3b82f6')
          outline.setAttribute('opacity', '0.45')
          outline.setAttribute('pointer-events', 'none')
          group.appendChild(outline)
        }
        group.appendChild(circle)
      }
    } else if (obj.svg_element === 'rect') {
      const rect = this._renderRect(obj)
      if (rect) {
        // Add data-object for click selection
        rect.setAttribute('data-object', String(obj.id))
        rect.style.cursor = 'pointer'
        
        if (isSelected) {
          const outline = rect.cloneNode(true)
          outline.setAttribute('fill', 'none')
          const strokeWidth = Number(rect.getAttribute('stroke-width') || 1)
          outline.setAttribute('stroke-width', strokeWidth + 2)
          outline.setAttribute('stroke', '#3b82f6')
          outline.setAttribute('opacity', '0.45')
          outline.setAttribute('pointer-events', 'none')
          group.appendChild(outline)
        }
        group.appendChild(rect)
      }
    }
    
    return group
  }

  /**
   * Render object as SVG path.
   * @param {object} obj - Object with nodes
   * @returns {SVGPathElement} SVG path element
   * @private
   */
  _renderPath(obj) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    
    let pathData = ''
    const nodes = obj.nodes || []
    
    if (nodes.length === 0) {
      return null
    }
    
    // Move to first point
    const first = nodes[0]
    pathData += `M ${first.x} ${first.y} `
    
    // Draw lines or curves
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1]
      const node = nodes[i]

      if (!prev || !node) continue
      
      const prevEnd = prev.end || prev
      const nodeStart = node.start || node

      const hasBezier = (prev.end && typeof prev.end.x === 'number' && typeof prev.end.y === 'number') ||
        (node.start && typeof node.start.x === 'number' && typeof node.start.y === 'number')
      
      if (hasBezier) {
        pathData += `C ${prevEnd.x ?? prev.x} ${prevEnd.y ?? prev.y}, ${nodeStart.x ?? node.x} ${nodeStart.y ?? node.y}, ${node.x} ${node.y} `
      } else {
        pathData += `L ${node.x} ${node.y} `
      }
    }
    
    // Close path if needed
    if (obj.closed !== false && nodes.length > 2) {
      const last = nodes[nodes.length - 1]
      const firstNode = nodes[0]
      const lastEnd = last.end || last
      const firstStart = firstNode.start || firstNode

      const hasBezier = (last.end && typeof last.end.x === 'number' && typeof last.end.y === 'number') ||
        (firstNode.start && typeof firstNode.start.x === 'number' && typeof firstNode.start.y === 'number')

      if (hasBezier) {
        pathData += `C ${lastEnd.x ?? last.x} ${lastEnd.y ?? last.y}, ${firstStart.x ?? firstNode.x} ${firstStart.y ?? firstNode.y}, ${firstNode.x} ${firstNode.y} `
      } else {
        pathData += `L ${firstNode.x} ${firstNode.y} `
      }
      pathData += 'Z'
    }
    
    path.setAttribute('d', pathData.trim())
    path.setAttribute('fill', obj.fill || 'none')
    path.setAttribute('stroke', obj.stroke || '#000')
    path.setAttribute('stroke-width', obj.strokeWidth || 1)
    path.setAttribute('opacity', obj.opacity !== undefined ? obj.opacity : 1)
    
    return path
  }

  /**
   * Render object as SVG circle.
   * @param {object} obj - Object data
   * @returns {SVGCircleElement} SVG circle element
   * @private
   */
  _renderCircle(obj) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    
    const center = obj.nodes && obj.nodes[0] ? obj.nodes[0] : { x: 0, y: 0 }
    const radius = obj.radius || 10
    
    circle.setAttribute('cx', center.x)
    circle.setAttribute('cy', center.y)
    circle.setAttribute('r', radius)
    circle.setAttribute('fill', obj.fill || 'none')
    circle.setAttribute('stroke', obj.stroke || '#000')
    circle.setAttribute('stroke-width', obj.strokeWidth || 1)
    circle.setAttribute('opacity', obj.opacity !== undefined ? obj.opacity : 1)
    
    return circle
  }

  /**
   * Render object as SVG rect.
   * @param {object} obj - Object data
   * @returns {SVGRectElement} SVG rect element
   * @private
   */
  _renderRect(obj) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    
    const first = obj.nodes && obj.nodes[0] ? obj.nodes[0] : { x: 0, y: 0 }
    const width = obj.width || 10
    const height = obj.height || 10
    
    rect.setAttribute('x', first.x - width / 2)
    rect.setAttribute('y', first.y - height / 2)
    rect.setAttribute('width', width)
    rect.setAttribute('height', height)
    rect.setAttribute('fill', obj.fill || 'none')
    rect.setAttribute('stroke', obj.stroke || '#000')
    rect.setAttribute('stroke-width', obj.strokeWidth || 1)
    rect.setAttribute('opacity', obj.opacity !== undefined ? obj.opacity : 1)
    
    return rect
  }

  /**
   * Calculate bounding box for a group's children.
   * @param {Array} children - Array of child objects
   * @returns {object|null} Bounding box { minX, minY, maxX, maxY, width, height }
   * @private
   */
  _calculateGroupBounds(children) {
    if (!children || children.length === 0) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    children.forEach(child => {
      const offset = child.offset || { x: 0, y: 0 }
      
      if (child.type === 'group' || child.svg_element === 'g') {
        // Recursively calculate bounds for nested groups
        const childBounds = this._calculateGroupBounds(child.children || [])
        if (childBounds) {
          minX = Math.min(minX, childBounds.minX + offset.x)
          minY = Math.min(minY, childBounds.minY + offset.y)
          maxX = Math.max(maxX, childBounds.maxX + offset.x)
          maxY = Math.max(maxY, childBounds.maxY + offset.y)
        }
      } else if (child.nodes && Array.isArray(child.nodes) && child.nodes.length > 0) {
        // Calculate bounds from nodes
        child.nodes.forEach(node => {
          const nodeX = (node.x || 0) + offset.x
          const nodeY = (node.y || 0) + offset.y
          minX = Math.min(minX, nodeX)
          minY = Math.min(minY, nodeY)
          maxX = Math.max(maxX, nodeX)
          maxY = Math.max(maxY, nodeY)
        })
      }
    })

    if (minX === Infinity) return null

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    }
  }

  /**
   * Calculate zoom scale based on viewBox and actual rendered size.
   * @returns {number} Zoom scale factor
   * @private
   */
  _getZoomScale() {
    if (!this.svg) return 1
    
    const viewBox = this.svg.viewBox?.baseVal
    if (!viewBox || viewBox.width === 0) return 1
    
    const svgRect = this.svg.getBoundingClientRect()
    if (!svgRect || svgRect.width === 0) return 1
    
    // Calculate zoom scale: viewBox width / actual rendered width
    const zoomScale = viewBox.width / svgRect.width
    return zoomScale
  }

  /**
   * Render control handles for an object.
   * @param {object} obj - Object to render controls for
   * @param {object} camera - Camera transform
   * @param {object|null} accumulatedTransform - Optional accumulated transform for nested objects
   * @returns {SVGGElement|null} Controls group element
   * @private
   */
  _renderControls(obj, camera = { x: 0, y: 0, z: 200 }, accumulatedTransform = null) {
    // Calculate zoom scale for fixed-size controls
    const zoomScale = this._getZoomScale()
    const controls = this.controlsConfig || DEFAULT_CONFIG.controls || {}
    
    // Compensate control sizes based on zoom scale
    const handleRadius = (controls.handleRadius || 4) / zoomScale
    const originRadius = (controls.originRadius || 6) / zoomScale
    const handleStrokeWidth = (controls.handleStrokeWidth || 1.5) / zoomScale
    const originStrokeWidth = (controls.originStrokeWidth || 2) / zoomScale
    const lineStrokeWidth = (controls.lineStrokeWidth || 1) / zoomScale
    const labelFontSize = (controls.labelFontSize || 10) / zoomScale
    const labelOffset = (controls.labelOffset || 6) / zoomScale
    const lineDashSize = (controls.lineDashSize || 2) / zoomScale
    const bboxDashSize = (controls.bboxDashSize || 5) / zoomScale
    // Handle groups - show bounding box and origin handle
    if (obj.type === 'group' || obj.svg_element === 'g') {
      const children = obj.children || []
      if (children.length === 0) return null

      const bounds = this._calculateGroupBounds(children)
      if (!bounds) return null

      const controlsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      controlsGroup.setAttribute('class', 'object-controls')
      controlsGroup.setAttribute('data-object-id', String(obj.id))

      // Use accumulated transform if provided (for nested objects), otherwise calculate from object
      let x, y, scale
      if (accumulatedTransform) {
        x = accumulatedTransform.x
        y = accumulatedTransform.y
        scale = accumulatedTransform.scale
      } else {
        x = (obj.offset?.x || 0) + (camera.x || 0)
        y = (obj.offset?.y || 0) + (camera.y || 0)
        scale = camera.z ? 200 / camera.z : 1
      }
      controlsGroup.setAttribute('transform', `translate(${x}, ${y}) scale(${scale})`)

      // Draw bounding box (make it draggable)
      const bboxPadding = 5 / zoomScale
      const bbox = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      bbox.setAttribute('x', bounds.minX - bboxPadding)
      bbox.setAttribute('y', bounds.minY - bboxPadding)
      bbox.setAttribute('width', bounds.width + (bboxPadding * 2))
      bbox.setAttribute('height', bounds.height + (bboxPadding * 2))
      bbox.setAttribute('fill', 'rgba(59, 130, 246, 0.1)')
      bbox.setAttribute('stroke', '#3b82f6')
      bbox.setAttribute('stroke-width', originStrokeWidth)
      bbox.setAttribute('stroke-dasharray', `${bboxDashSize},${bboxDashSize}`)
      bbox.setAttribute('opacity', '0.6')
      bbox.setAttribute('vector-effect', 'non-scaling-stroke')
      bbox.setAttribute('data-type', 'origin')
      bbox.setAttribute('data-object-id', String(obj.id))
      bbox.setAttribute('data-index', '0')
      bbox.style.cursor = 'move'
      bbox.style.pointerEvents = 'all'
      controlsGroup.appendChild(bbox)

      // Origin handle at center of bounding box
      const centerX = (bounds.minX + bounds.maxX) / 2
      const centerY = (bounds.minY + bounds.maxY) / 2

      const originHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      originHandle.setAttribute('cx', centerX)
      originHandle.setAttribute('cy', centerY)
      originHandle.setAttribute('r', originRadius)
      originHandle.setAttribute('fill', '#8b5cf6')
      originHandle.setAttribute('stroke', '#7c3aed')
      originHandle.setAttribute('stroke-width', originStrokeWidth)
      originHandle.setAttribute('class', 'handle origin-handle')
      originHandle.setAttribute('data-type', 'origin')
      originHandle.setAttribute('data-index', '0')
      originHandle.setAttribute('data-object-id', String(obj.id))
      originHandle.style.cursor = 'move'
      controlsGroup.appendChild(originHandle)

      return controlsGroup
    }

    // Regular objects with nodes
    if (!obj || !obj.nodes || !Array.isArray(obj.nodes) || obj.nodes.length === 0) {
      return null
    }

    const controlsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    controlsGroup.setAttribute('class', 'object-controls')
    controlsGroup.setAttribute('data-object-id', String(obj.id))

    // Use accumulated transform if provided (for nested objects), otherwise calculate from object
    let x, y, scale
    if (accumulatedTransform) {
      x = accumulatedTransform.x
      y = accumulatedTransform.y
      scale = accumulatedTransform.scale
    } else {
      x = (obj.offset?.x || 0) + (camera.x || 0)
      y = (obj.offset?.y || 0) + (camera.y || 0)
      scale = camera.z ? 200 / camera.z : 1
    }
    controlsGroup.setAttribute('transform', `translate(${x}, ${y}) scale(${scale})`)

    // Transform nodes to screen coordinates for handle rendering
    const transformedNodes = obj.nodes.map(node => {
      const start = node.start || { x: node.x, y: node.y }
      const end = node.end || { x: node.x, y: node.y }
      return {
        point: { x: node.x, y: node.y },
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y }
      }
    })

    // Render connector lines and handles for each node
    transformedNodes.forEach((tNode, i) => {
      const node = obj.nodes[i]

      // Connector lines
      const startLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      startLine.setAttribute('x1', tNode.point.x)
      startLine.setAttribute('y1', tNode.point.y)
      startLine.setAttribute('x2', tNode.start.x)
      startLine.setAttribute('y2', tNode.start.y)
      startLine.setAttribute('stroke', '#94a3b8')
      startLine.setAttribute('stroke-width', lineStrokeWidth)
      startLine.setAttribute('stroke-dasharray', `${lineDashSize},${lineDashSize}`)
      startLine.setAttribute('opacity', '0.6')
      startLine.setAttribute('vector-effect', 'non-scaling-stroke')
      controlsGroup.appendChild(startLine)

      const endLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      endLine.setAttribute('x1', tNode.point.x)
      endLine.setAttribute('y1', tNode.point.y)
      endLine.setAttribute('x2', tNode.end.x)
      endLine.setAttribute('y2', tNode.end.y)
      endLine.setAttribute('stroke', '#94a3b8')
      endLine.setAttribute('stroke-width', lineStrokeWidth)
      endLine.setAttribute('stroke-dasharray', `${lineDashSize},${lineDashSize}`)
      endLine.setAttribute('opacity', '0.6')
      endLine.setAttribute('vector-effect', 'non-scaling-stroke')
      controlsGroup.appendChild(endLine)

      // Start control handle
      const startHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      startHandle.setAttribute('cx', tNode.start.x)
      startHandle.setAttribute('cy', tNode.start.y)
      startHandle.setAttribute('r', handleRadius)
      startHandle.setAttribute('fill', '#60a5fa')
      startHandle.setAttribute('stroke', '#3b82f6')
      startHandle.setAttribute('stroke-width', handleStrokeWidth)
      startHandle.setAttribute('class', 'handle handle-start')
      startHandle.setAttribute('data-type', 'start')
      startHandle.setAttribute('data-index', String(i))
      startHandle.setAttribute('data-object-id', String(obj.id))
      startHandle.style.cursor = 'pointer'
      controlsGroup.appendChild(startHandle)

      // End control handle
      const endHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      endHandle.setAttribute('cx', tNode.end.x)
      endHandle.setAttribute('cy', tNode.end.y)
      endHandle.setAttribute('r', handleRadius)
      endHandle.setAttribute('fill', '#60a5fa')
      endHandle.setAttribute('stroke', '#3b82f6')
      endHandle.setAttribute('stroke-width', handleStrokeWidth)
      endHandle.setAttribute('class', 'handle handle-end')
      endHandle.setAttribute('data-type', 'end')
      endHandle.setAttribute('data-index', String(i))
      endHandle.setAttribute('data-object-id', String(obj.id))
      endHandle.style.cursor = 'pointer'
      controlsGroup.appendChild(endHandle)

      // Anchor point handle
      const anchorHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      anchorHandle.setAttribute('cx', tNode.point.x)
      anchorHandle.setAttribute('cy', tNode.point.y)
      anchorHandle.setAttribute('r', handleRadius)
      anchorHandle.setAttribute('fill', '#fbbf24')
      anchorHandle.setAttribute('stroke', '#f59e0b')
      anchorHandle.setAttribute('stroke-width', handleStrokeWidth)
      anchorHandle.setAttribute('class', 'handle anchor-point')
      anchorHandle.setAttribute('data-type', 'anchor')
      anchorHandle.setAttribute('data-index', String(i))
      anchorHandle.setAttribute('data-object-id', String(obj.id))
      anchorHandle.style.cursor = 'move'
      controlsGroup.appendChild(anchorHandle)

      // // Label
      // const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      // label.setAttribute('x', tNode.point.x + labelOffset)
      // label.setAttribute('y', tNode.point.y - labelOffset)
      // label.setAttribute('fill', '#cbd5e0')
      // label.setAttribute('font-size', `${labelFontSize}px`)
      // label.setAttribute('font-family', 'system-ui, sans-serif')
      // label.textContent = `P${i}`
      // controlsGroup.appendChild(label)
    })

    // Origin handle (center of object)
    let cx = 0
    let cy = 0
    transformedNodes.forEach(tNode => {
      cx += tNode.point.x
      cy += tNode.point.y
    })
    cx /= transformedNodes.length
    cy /= transformedNodes.length

    const originHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    originHandle.setAttribute('cx', cx)
    originHandle.setAttribute('cy', cy)
    originHandle.setAttribute('r', originRadius)
    originHandle.setAttribute('fill', '#8b5cf6')
    originHandle.setAttribute('stroke', '#7c3aed')
    originHandle.setAttribute('stroke-width', originStrokeWidth)
    originHandle.setAttribute('class', 'handle origin-handle')
    originHandle.setAttribute('data-type', 'origin')
    originHandle.setAttribute('data-index', '0')
    originHandle.setAttribute('data-object-id', String(obj.id))
    originHandle.style.cursor = 'move'
    controlsGroup.appendChild(originHandle)

    return controlsGroup
  }

  setControlsConfig(controls) {
    this.controlsConfig = controls || DEFAULT_CONFIG.controls
  }

  /**
   * Resize the SVG renderer.
   * @param {number} width - New width (container width, not used for SVG)
   * @param {number} height - New height (container height, not used for SVG)
   */
  resize(width, height) {
    super.resize(width, height)
    if (this.svg) {
      this.svg.style.width = width
      this.svg.style.height = height
    }
  }
}

