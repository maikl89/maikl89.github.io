/**
 * Collection Storage - Handles persistence of collection data
 * Provides storage abstraction for collection objects.
 */

import { StorageManager } from '../../utils/storage.js'
import { isArray } from '../../utils/validation.js'

export class CollectionStorage {
  /**
   * Create collection storage.
   * @param {string} storageKey - Storage key for collection data
   */
  constructor(storageKey = 'preview2-collection') {
    this.storage = new StorageManager('preview2')
    this.storageKey = storageKey
  }

  /**
   * Load collection from storage.
   * @returns {Array} Array of objects or empty array
   */
  load() {
    const data = this.storage.get(this.storageKey, [])
    
    // Validate data structure
    if (!isArray(data)) {
      console.warn('Invalid collection data in storage, returning empty array')
      return []
    }
    
    return data
  }

  /**
   * Save collection to storage.
   * @param {Array} objects - Array of objects to save
   * @returns {boolean} Success status
   */
  save(objects) {
    if (!isArray(objects)) {
      console.warn('Cannot save: objects must be an array')
      return false
    }
    
    return this.storage.set(this.storageKey, objects)
  }

  /**
   * Clear collection from storage.
   * @returns {boolean} Success status
   */
  clear() {
    return this.storage.remove(this.storageKey)
  }

  /**
   * Export collection as JSON string.
   * @param {Array} objects - Array of objects to export
   * @returns {string} JSON string
   */
  export(objects) {
    if (!isArray(objects)) {
      return JSON.stringify([], null, 2)
    }
    
    return JSON.stringify(objects, null, 2)
  }

  /**
   * Import collection from JSON string.
   * @param {string} json - JSON string
   * @returns {Array} Array of imported objects
   */
  import(json) {
    try {
      const data = JSON.parse(json)
      
      if (!isArray(data)) {
        throw new Error('Imported data must be an array')
      }
      
      return data
    } catch (error) {
      console.error('Failed to import collection:', error)
      throw new Error(`Invalid JSON: ${error.message}`)
    }
  }

  /**
   * Get storage size (approximate).
   * @returns {number} Approximate size in bytes
   */
  getSize() {
    const data = this.export(this.load())
    return new Blob([data]).size
  }
}

