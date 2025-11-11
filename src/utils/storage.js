/**
 * Storage utilities for Preview2
 * Provides localStorage wrapper with error handling and type safety.
 */

/**
 * Storage manager class.
 */
export class StorageManager {
  /**
   * Create a storage manager.
   * @param {string} prefix - Key prefix for namespacing
   */
  constructor(prefix = 'preview2') {
    this.prefix = prefix
  }

  /**
   * Get full key name with prefix.
   * @param {string} key - Storage key
   * @returns {string} Prefixed key
   */
  _getKey(key) {
    return `${this.prefix}:${key}`
  }

  /**
   * Get item from storage.
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Stored value or default
   */
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(this._getKey(key))
      if (item === null) return defaultValue
      return JSON.parse(item)
    } catch (error) {
      console.warn(`Failed to get storage item "${key}":`, error)
      return defaultValue
    }
  }

  /**
   * Set item in storage.
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {boolean} Success status
   */
  set(key, value) {
    try {
      localStorage.setItem(this._getKey(key), JSON.stringify(value))
      return true
    } catch (error) {
      console.warn(`Failed to set storage item "${key}":`, error)
      return false
    }
  }

  /**
   * Remove item from storage.
   * @param {string} key - Storage key
   * @returns {boolean} Success status
   */
  remove(key) {
    try {
      localStorage.removeItem(this._getKey(key))
      return true
    } catch (error) {
      console.warn(`Failed to remove storage item "${key}":`, error)
      return false
    }
  }

  /**
   * Clear all items with this prefix.
   * @returns {boolean} Success status
   */
  clear() {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(this._getKey(''))) {
          localStorage.removeItem(key)
        }
      })
      return true
    } catch (error) {
      console.warn('Failed to clear storage:', error)
      return false
    }
  }

  /**
   * Check if key exists in storage.
   * @param {string} key - Storage key
   * @returns {boolean} True if key exists
   */
  has(key) {
    return localStorage.getItem(this._getKey(key)) !== null
  }
}

/**
 * Default storage manager instance.
 */
export const storage = new StorageManager()

/**
 * Convenience functions using default storage manager.
 */
export const storageUtils = {
  get: (key, defaultValue) => storage.get(key, defaultValue),
  set: (key, value) => storage.set(key, value),
  remove: (key) => storage.remove(key),
  clear: () => storage.clear(),
  has: (key) => storage.has(key)
}

