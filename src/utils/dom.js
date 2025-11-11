/**
 * DOM utilities for Preview2
 * Provides common DOM manipulation and event handling functions.
 */

/**
 * Get element by ID (shorthand).
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} Element or null if not found
 */
export function $(id) {
  return document.getElementById(id)
}

/**
 * Query selector (shorthand).
 * @param {string} selector - CSS selector
 * @param {Element} root - Root element (default: document)
 * @returns {Element|null} First matching element or null
 */
export function qs(selector, root = document) {
  return root.querySelector(selector)
}

/**
 * Query selector all (shorthand).
 * @param {string} selector - CSS selector
 * @param {Element} root - Root element (default: document)
 * @returns {NodeList} All matching elements
 */
export function qsAll(selector, root = document) {
  return root.querySelectorAll(selector)
}

/**
 * Add event listener (shorthand).
 * @param {string} event - Event type
 * @param {Function} callback - Event handler
 * @param {Element|Document} source - Source element (default: document)
 * @param {boolean|object} options - Event options (useCapture or options object)
 */
export function onEvent(event, callback, source = document, options = false) {
  source.addEventListener(event, callback, options)
}

/**
 * Remove event listener (shorthand).
 * @param {string} event - Event type
 * @param {Function} callback - Event handler
 * @param {Element|Document} source - Source element (default: document)
 * @param {boolean|object} options - Event options
 */
export function offEvent(event, callback, source = document, options = false) {
  source.removeEventListener(event, callback, options)
}

/**
 * Create a new DOM element.
 * @param {string} tag - HTML tag name
 * @param {object} attributes - Element attributes
 * @param {string|Element} content - Text content or child element
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, attributes = {}, content = null) {
  const element = document.createElement(tag)
  
  // Set attributes
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value)
    } else if (key.startsWith('data-')) {
      element.setAttribute(key, value)
    } else {
      element[key] = value
    }
  })
  
  // Set content
  if (content !== null) {
    if (typeof content === 'string') {
      element.textContent = content
    } else if (content instanceof Element) {
      element.appendChild(content)
    } else if (Array.isArray(content)) {
      content.forEach(child => {
        if (child instanceof Element) {
          element.appendChild(child)
        }
      })
    }
  }
  
  return element
}

/**
 * Throttle function calls.
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, delay) {
  let lastCall = 0
  return function (...args) {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      return func.apply(this, args)
    }
  }
}

/**
 * Debounce function calls.
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, delay) {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(this, args), delay)
  }
}

