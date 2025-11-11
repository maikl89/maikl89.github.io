/**
 * ModuleManager - Manages animation modules and metadata
 */

import { StorageManager } from '../../utils/storage.js'
import { validateId, validateNonEmpty } from '../../utils/validation.js'

export class ModuleManager {
  constructor(options = {}) {
    this.modules = new Map() // name -> moduleData
    this.storage = new StorageManager('preview2-modules')
    this.metadataKey = options.metadataKey || 'metadata'
    this.modulePrefix = options.modulePrefix || 'module:'
    this.loaded = false
  }

  /**
   * Load modules from storage.
   */
  loadFromStorage() {
    if (this.loaded) return

    const metadata = this.storage.get(this.metadataKey, [])
    metadata.forEach(meta => {
      const source = this.storage.get(`${this.modulePrefix}${meta.id}`, null)
      if (source) {
        this.modules.set(meta.name, { ...meta, source, factory: null })
      }
    })

    this.loaded = true
  }

  /**
   * Save metadata to storage.
   * @private
   */
  _saveMetadata() {
    const metadata = Array.from(this.modules.values()).map(module => ({
      id: module.id,
      name: module.name,
      createdAt: module.createdAt,
      updatedAt: module.updatedAt
    }))
    this.storage.set(this.metadataKey, metadata)
  }

  /**
   * Register a module.
   * @param {string} name
   * @param {string} source
   * @param {string} [id]
   * @returns {object} metadata
   */
  registerModule(name, source, id = null) {
    this.loadFromStorage()

    if (!validateNonEmpty(name)) {
      throw new Error('Module name is required')
    }
    if (!validateNonEmpty(source)) {
      throw new Error('Module source is required')
    }

    const moduleId = id && validateId(id) ? id : this._generateId(name)
    const timestamp = Date.now()

    const moduleData = {
      id: moduleId,
      name,
      source,
      factory: null,
      createdAt: this.modules.get(name)?.createdAt || timestamp,
      updatedAt: timestamp
    }

    this.modules.set(name, moduleData)
    this.storage.set(`${this.modulePrefix}${moduleId}`, source)
    this._saveMetadata()

    return moduleData
  }

  /**
   * Get module metadata by name.
   */
  getModule(name) {
    this.loadFromStorage()
    return this.modules.get(name) || null
  }

  /**
   * Get all module metadata.
   */
  getAllModules() {
    this.loadFromStorage()
    return Array.from(this.modules.values())
  }

  /**
   * Remove a module.
   * @param {string} name
   * @returns {boolean}
   */
  removeModule(name) {
    this.loadFromStorage()
    const module = this.modules.get(name)
    if (!module) return false

    this.storage.remove(`${this.modulePrefix}${module.id}`)
    this.modules.delete(name)
    this._saveMetadata()
    return true
  }

  /**
   * Generate unique module ID.
   * @private
   */
  _generateId(name) {
    return `module_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
}
