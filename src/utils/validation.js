/**
 * Validation utilities for Preview2
 * Provides common validation functions for data integrity.
 */

/**
 * Check if value is a valid number.
 * @param {*} value - Value to check
 * @returns {boolean} True if valid number
 */
export function isNumber(value) {
  return typeof value === 'number' && !isNaN(value) && isFinite(value)
}

/**
 * Check if value is a valid integer.
 * @param {*} value - Value to check
 * @returns {boolean} True if valid integer
 */
export function isInteger(value) {
  return isNumber(value) && Number.isInteger(value)
}

/**
 * Check if value is a valid string.
 * @param {*} value - Value to check
 * @returns {boolean} True if valid string
 */
export function isString(value) {
  return typeof value === 'string'
}

/**
 * Check if value is a valid object (not null, not array).
 * @param {*} value - Value to check
 * @returns {boolean} True if valid object
 */
export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Check if value is a valid array.
 * @param {*} value - Value to check
 * @returns {boolean} True if valid array
 */
export function isArray(value) {
  return Array.isArray(value)
}

/**
 * Check if value is not null and not undefined.
 * @param {*} value - Value to check
 * @returns {boolean} True if value exists
 */
export function isDefined(value) {
  return value !== null && value !== undefined
}

/**
 * Validate object has required properties.
 * @param {object} obj - Object to validate
 * @param {string[]} required - Array of required property names
 * @returns {{valid: boolean, missing: string[]}} Validation result
 */
export function validateRequired(obj, required) {
  if (!isObject(obj)) {
    return { valid: false, missing: required }
  }
  
  const missing = required.filter(key => !(key in obj) || obj[key] === undefined)
  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * Validate number is within range.
 * @param {number} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} True if within range
 */
export function validateRange(value, min, max) {
  return isNumber(value) && value >= min && value <= max
}

/**
 * Validate string is not empty.
 * @param {string} value - Value to validate
 * @returns {boolean} True if non-empty string
 */
export function validateNonEmpty(value) {
  return isString(value) && value.trim().length > 0
}

/**
 * Validate ID format (alphanumeric with underscores/hyphens).
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid ID format
 */
export function validateId(id) {
  return isString(id) && /^[a-zA-Z0-9_-]+$/.test(id)
}

