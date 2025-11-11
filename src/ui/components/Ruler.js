/**
 * Ruler Component - Displays measurement rulers
 * Shows horizontal (top) and vertical (left) rulers with tick marks and labels.
 */

export class Ruler {
  /**
   * Create a ruler component.
   * @param {object} options - Ruler options
   * @param {HTMLElement} options.container - Container element
   * @param {string} options.orientation - 'horizontal' or 'vertical'
   * @param {number} options.size - Ruler size in pixels (height for horizontal, width for vertical)
   */
  constructor({ container, orientation = 'horizontal', size = 20 } = {}) {
    if (!container) {
      throw new Error('Container is required')
    }
    
    this.container = container
    this.orientation = orientation
    this.size = size
    this.element = null
    this.camera = { x: 0, y: 0, z: 200 }
    this.viewBox = { x: 0, y: 0, width: 1920, height: 1080 }
    
    this._createElement()
  }

  /**
   * Create the ruler element.
   * @private
   */
  _createElement() {
    this.element = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    this.element.classList.add('ruler', `ruler--${this.orientation}`)
    this.element.style.position = 'absolute'
    this.element.style.pointerEvents = 'none'
    this.element.style.userSelect = 'none'
    
    if (this.orientation === 'horizontal') {
      this.element.style.top = '0'
      this.element.style.left = `${this.size}px` // Account for vertical ruler
      this.element.style.width = `calc(100% - ${this.size}px)`
      this.element.style.height = `${this.size}px`
      this.element.style.zIndex = '10'
    } else {
      this.element.style.top = `${this.size}px` // Account for horizontal ruler
      this.element.style.left = '0'
      this.element.style.width = `${this.size}px`
      this.element.style.height = `calc(100% - ${this.size}px)`
      this.element.style.zIndex = '10'
    }
    
    this.container.appendChild(this.element)
  }

  /**
   * Update ruler with camera and viewBox info.
   * @param {object} camera - Camera state
   * @param {object} viewBox - ViewBox dimensions
   */
  update(camera, viewBox) {
    this.camera = camera || this.camera
    this.viewBox = viewBox || this.viewBox
    this._render()
  }

  /**
   * Render the ruler.
   * @private
   */
  _render() {
    if (!this.element) return
    
    const rect = this.container.getBoundingClientRect()
    const containerWidth = rect.width
    const containerHeight = rect.height
    
    // Clear previous content
    this.element.innerHTML = ''
    
    // Set SVG dimensions (account for ruler size)
    if (this.orientation === 'horizontal') {
      const rulerWidth = containerWidth - this.size // Account for vertical ruler
      this.element.setAttribute('width', rulerWidth)
      this.element.setAttribute('height', this.size)
      this.element.setAttribute('viewBox', `0 0 ${rulerWidth} ${this.size}`)
      this._renderHorizontal(rulerWidth)
    } else {
      const rulerHeight = containerHeight - this.size // Account for horizontal ruler
      this.element.setAttribute('width', this.size)
      this.element.setAttribute('height', rulerHeight)
      this.element.setAttribute('viewBox', `0 0 ${this.size} ${rulerHeight}`)
      this._renderVertical(rulerHeight)
    }
  }

  /**
   * Render horizontal ruler (top).
   * @param {number} width - Container width
   * @private
   */
  _renderHorizontal(width) {
    // Calculate scale based on zoom (viewBox width vs base width)
    const baseWidth = 1920
    const baseHeight = 1080
    const zoom = this.camera.z / 200 // Convert camera z to zoom level (200 = 1.0)
    const scale = 1 / zoom // Scale factor (1.0 = 100% zoom)
    
    // Calculate the visible range in world coordinates
    // viewBox x/y represents pan position, width/height represents zoom
    const viewBoxLeft = (this.viewBox.x || 0) / scale
    const viewBoxRight = ((this.viewBox.x || 0) + (this.viewBox.width || baseWidth)) / scale
    
    // Determine step size based on zoom level
    let step = 100
    if (scale < 0.1) step = 1000
    else if (scale < 0.5) step = 500
    else if (scale < 1) step = 200
    else if (scale < 2) step = 100
    else if (scale < 5) step = 50
    else step = 10
    
    // Draw background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    bg.setAttribute('x', '0')
    bg.setAttribute('y', '0')
    bg.setAttribute('width', width)
    bg.setAttribute('height', this.size)
    bg.setAttribute('fill', 'var(--glass-bg, rgba(13, 18, 28, 0.82))')
    // bg.setAttribute('stroke', 'var(--glass-border, rgba(82, 93, 149, 0.22))')
    // bg.setAttribute('stroke-width', '1')
    this.element.appendChild(bg)

    const border = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    border.setAttribute('x1', '0')
    border.setAttribute('y1', this.size)
    border.setAttribute('x2', width)
    border.setAttribute('y2', this.size)
    border.setAttribute('stroke', 'var(--text-secondary, rgba(203, 213, 225, 0.75))')
    border.setAttribute('stroke-width', '1')
    this.element.appendChild(border)
    
    // Draw tick marks and labels
    const start = Math.floor(viewBoxLeft / step) * step
    const end = Math.ceil(viewBoxRight / step) * step
    
    for (let value = start; value <= end; value += step) {
      // Calculate screen position
      const screenX = ((value - viewBoxLeft) / (viewBoxRight - viewBoxLeft)) * width
      
      if (screenX < 0 || screenX > width) continue
      
      // Draw major tick
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      tick.setAttribute('x1', screenX)
      tick.setAttribute('y1', 4)
      tick.setAttribute('x2', screenX)
      tick.setAttribute('y2', this.size)
      tick.setAttribute('stroke', 'var(--text-secondary, rgba(203, 213, 225, 0.75))')
      tick.setAttribute('stroke-width', '1')
      this.element.appendChild(tick)
      
      // Draw label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      label.setAttribute('x', screenX + 2)
      label.setAttribute('y', 8)
      label.setAttribute('fill', 'var(--text-secondary, rgba(203, 213, 225, 0.75))')
      label.setAttribute('font-size', '8px')
      label.setAttribute('font-family', 'system-ui, sans-serif')
      label.setAttribute('text-anchor', 'start')
      label.textContent = Math.round(value)
      this.element.appendChild(label)
      
      // Draw minor ticks
      for (let minor = 1; minor < 5; minor++) {
        const minorValue = value + (step / 5) * minor
        const minorScreenX = ((minorValue - viewBoxLeft) / (viewBoxRight - viewBoxLeft)) * width
        
        if (minorScreenX < 0 || minorScreenX > width) continue
        
        const minorTick = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        minorTick.setAttribute('x1', minorScreenX)
        minorTick.setAttribute('y1', this.size * 0.6)
        minorTick.setAttribute('x2', minorScreenX)
        minorTick.setAttribute('y2', this.size)
        minorTick.setAttribute('stroke', 'var(--text-secondary, rgba(203, 213, 225, 0.5))')
        minorTick.setAttribute('stroke-width', '0.5')
        this.element.appendChild(minorTick)
      }
    }
  }

  /**
   * Render vertical ruler (left).
   * @param {number} height - Container height
   * @private
   */
  _renderVertical(height) {
    // Calculate scale based on zoom (viewBox width vs base width)
    const baseWidth = 1920
    const baseHeight = 1080
    const zoom = this.camera.z / 200 // Convert camera z to zoom level (200 = 1.0)
    const scale = 1 / zoom // Scale factor (1.0 = 100% zoom)
    
    // Calculate the visible range in world coordinates
    // viewBox x/y represents pan position, width/height represents zoom
    const viewBoxTop = (this.viewBox.y || 0) / scale
    const viewBoxBottom = ((this.viewBox.y || 0) + (this.viewBox.height || baseHeight)) / scale
    
    // Determine step size based on zoom level
    let step = 100
    if (scale < 0.1) step = 1000
    else if (scale < 0.5) step = 500
    else if (scale < 1) step = 200
    else if (scale < 2) step = 100
    else if (scale < 5) step = 50
    else step = 10
    
    // Draw background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    bg.setAttribute('x', '0')
    bg.setAttribute('y', '0')
    bg.setAttribute('width', this.size)
    bg.setAttribute('height', height)
    bg.setAttribute('fill', 'var(--glass-bg, rgba(13, 18, 28, 0.82))')
    bg.setAttribute('stroke', 'var(--glass-border, rgba(82, 93, 149, 0.22))')
    bg.setAttribute('stroke-width', '1')
    this.element.appendChild(bg)
    
    const border = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    border.setAttribute('x1', this.size)
    border.setAttribute('y1', 0)
    border.setAttribute('x2', this.size)
    border.setAttribute('y2', height)
    border.setAttribute('stroke', 'var(--text-secondary, rgba(203, 213, 225, 0.75))')
    border.setAttribute('stroke-width', '1')
    this.element.appendChild(border)

    // Draw tick marks and labels
    const start = Math.floor(viewBoxTop / step) * step
    const end = Math.ceil(viewBoxBottom / step) * step
    
    for (let value = start; value <= end; value += step) {
      // Calculate screen position
      const screenY = ((value - viewBoxTop) / (viewBoxBottom - viewBoxTop)) * height
      
      if (screenY < 0 || screenY > height) continue
      
      // Draw major tick
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      tick.setAttribute('x1', 4)
      tick.setAttribute('y1', screenY)
      tick.setAttribute('x2', this.size)
      tick.setAttribute('y2', screenY)
      tick.setAttribute('stroke', 'var(--text-secondary, rgba(203, 213, 225, 0.75))')
      tick.setAttribute('stroke-width', '1')
      this.element.appendChild(tick)
      
      // Draw label (rotated)
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      label.setAttribute('x', 0)
      label.setAttribute('y', screenY + 8)
      label.setAttribute('fill', 'var(--text-secondary, rgba(203, 213, 225, 0.75))')
      label.setAttribute('font-size', '8px')
      label.setAttribute('font-family', 'system-ui, sans-serif')
      label.setAttribute('text-anchor', 'start')
      label.setAttribute('dominant-baseline', 'middle')
      label.textContent = Math.round(value)
      this.element.appendChild(label)
      
      // Draw minor ticks
      for (let minor = 1; minor < 5; minor++) {
        const minorValue = value + (step / 5) * minor
        const minorScreenY = ((minorValue - viewBoxTop) / (viewBoxBottom - viewBoxTop)) * height
        
        if (minorScreenY < 0 || minorScreenY > height) continue
        
        const minorTick = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        minorTick.setAttribute('x1', this.size * 0.6)
        minorTick.setAttribute('y1', minorScreenY)
        minorTick.setAttribute('x2', this.size)
        minorTick.setAttribute('y2', minorScreenY)
        minorTick.setAttribute('stroke', 'var(--text-secondary, rgba(203, 213, 225, 0.5))')
        minorTick.setAttribute('stroke-width', '0.5')
        this.element.appendChild(minorTick)
      }
    }
  }

  /**
   * Resize the ruler.
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    this._render()
  }

  /**
   * Remove the ruler.
   */
  destroy() {
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element)
    }
    this.element = null
  }
}

