/**
 * Collection Manager - Manages animation objects collection (assets)
 * Provides CRUD operations and collection state management.
 * Works with ProjectManager to manage assets within projects.
 */

import { validateId, isObject, isArray } from '../../utils/validation.js'

export class CollectionManager {
  /**
   * Create a collection manager.
   * @param {object} options - Collection options
   * @param {ProjectManager} options.projectManager - Project manager instance
   */
  constructor(options = {}) {
    this.projectManager = options.projectManager || null
    this.objects = []
    this.listeners = new Set()
    
    // Subscribe to project changes
    if (this.projectManager) {
      this.projectManager.subscribe(() => {
        this._loadFromProject()
      })
    }
    
    // Load from current project
    this._loadFromProject()
  }

  /**
   * Add a listener for collection changes.
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Notify all listeners of collection changes.
   * @private
   */
  _notify() {
    this.listeners.forEach(callback => {
      try {
        callback(this.objects)
      } catch (error) {
        console.warn('Collection listener error:', error)
      }
    })
  }

  /**
   * Load assets from current project.
   * @private
   */
  _loadFromProject() {
    if (!this.projectManager) {
      this.objects = []
      return
    }
    
    const assets = this.projectManager.getCurrentAssets()
    this.objects = isArray(assets) ? [...assets] : []
    this._notify()
  }

  /**
   * Save assets to current project (only if changed).
   * @returns {boolean} Success status
   */
  save() {
    if (!this.projectManager) {
      return false
    }
    
    // Update current project assets
    this.projectManager.updateCurrentAssets(this.objects)
    return true
  }

  /**
   * Get all objects.
   * @returns {Array} Array of objects
   */
  getAll() {
    return [...this.objects]
  }

  /**
   * Get object by ID.
   * @param {string} id - Object ID
   * @returns {object|null} Object or null if not found
   */
  getById(id) {
    if (!validateId(id)) return null
    return this.objects.find(obj => obj.id === id) || null
  }

  /**
   * Add object to collection.
   * @param {object} obj - Object to add
   * @returns {object} Added object with generated ID if needed
   */
  add(obj) {
    if (!isObject(obj)) {
      throw new Error('Object must be a valid object')
    }

    // Generate ID if not provided
    if (!obj.id || !validateId(obj.id)) {
      obj.id = this._generateId()
    }

    // Check for duplicate ID
    if (this.getById(obj.id)) {
      throw new Error(`Object with ID "${obj.id}" already exists`)
    }

    this.objects.push(obj)
    this.save()
    this._notify()
    
    return obj
  }

  /**
   * Update object in collection.
   * @param {string} id - Object ID
   * @param {object} updates - Partial object updates
   * @returns {object|null} Updated object or null if not found
   */
  update(id, updates) {
    if (!validateId(id)) return null
    if (!isObject(updates)) {
      throw new Error('Updates must be a valid object')
    }

    // Find object (might be nested in a group)
    const obj = this.findInGroups(id)
    if (!obj) return null

    // Merge updates
    Object.assign(obj, updates)
    
    this.save()
    this._notify()
    
    return obj
  }

  /**
   * Remove object from collection.
   * @param {string} id - Object ID
   * @returns {boolean} True if removed, false if not found
   */
  remove(id) {
    if (!validateId(id)) return false

    const index = this.objects.findIndex(obj => obj.id === id)
    if (index === -1) return false

    this.objects.splice(index, 1)
    this.save()
    this._notify()
    
    return true
  }

  /**
   * Clear all objects from collection.
   */
  clear() {
    this.objects = []
    this.save()
    this._notify()
  }

  /**
   * Get collection size.
   * @returns {number} Number of objects
   */
  size() {
    return this.objects.length
  }

  /**
   * Check if collection is empty.
   * @returns {boolean} True if empty
   */
  isEmpty() {
    return this.objects.length === 0
  }

  /**
   * Generate a unique ID for an object.
   * @returns {string} Generated ID
   * @private
   */
  _generateId() {
    let id
    let attempts = 0
    do {
      id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      attempts++
      if (attempts > 100) {
        throw new Error('Failed to generate unique ID')
      }
    } while (this.getById(id))
    
    return id
  }

  /**
   * Clone an object (deep copy).
   * @param {string} id - Object ID to clone
   * @returns {object|null} Cloned object or null if not found
   */
  clone(id) {
    const obj = this.getById(id)
    if (!obj) return null

    const cloned = JSON.parse(JSON.stringify(obj))
    cloned.id = this._generateId()
    cloned.name = cloned.name ? `${cloned.name}_copy` : cloned.id
    
    return this.add(cloned)
  }

  /**
   * Find objects matching a predicate.
   * @param {Function} predicate - Filter function
   * @returns {Array} Matching objects
   */
  find(predicate) {
    return this.objects.filter(predicate)
  }

  /**
   * Get objects by type.
   * @param {string} type - Object type
   * @returns {Array} Objects of specified type
   */
  getByType(type) {
    return this.objects.filter(obj => obj.type === type)
  }

  /**
   * Move an object into a group.
   * @param {string} objectId - ID of object to move
   * @param {string} groupId - ID of target group
   * @returns {boolean} True if successful, false otherwise
   */
  moveToGroup(objectId, groupId) {
    if (!validateId(objectId) || !validateId(groupId)) return false

    // Find object (might be in a group already)
    const obj = this.findInGroups(objectId)
    const group = this.getById(groupId)

    if (!obj || !group) return false

    // Check if target is actually a group
    if (group.type !== 'group' && group.svg_element !== 'g') {
      return false
    }

    // Can't move a group into itself
    if (objectId === groupId) {
      return false
    }

    // Can't move a group into one of its own children (prevent circular references)
    if (this._isDescendantOf(groupId, objectId)) {
      return false
    }

    // Can't move a group that contains the target group (prevent circular references)
    if ((obj.type === 'group' || obj.svg_element === 'g') && this._isDescendantOf(objectId, groupId)) {
      return false
    }

    // Remove object from top-level collection if it exists there
    const topLevelIndex = this.objects.findIndex(o => o.id === objectId)
    if (topLevelIndex !== -1) {
      this.objects.splice(topLevelIndex, 1)
    }

    // Remove from any existing group
    this._removeFromAnyGroup(objectId)

    // Add to target group
    if (!group.children) {
      group.children = []
    }
    group.children.push(obj)

    this.save()
    this._notify()
    return true
  }

  /**
   * Remove an object from its group (move to top level).
   * @param {string} objectId - ID of object to remove from group
   * @returns {boolean} True if successful, false otherwise
   */
  removeFromGroup(objectId) {
    if (!validateId(objectId)) return false

    const obj = this.findInGroups(objectId)
    if (!obj) return false

    // Remove from group
    this._removeFromAnyGroup(objectId)

    // Add to top level if not already there
    if (!this.getById(objectId)) {
      this.objects.push(obj)
    }

    this.save()
    this._notify()
    return true
  }

  /**
   * Find an object in groups (recursive search).
   * @param {string} objectId - ID to find
   * @returns {object|null} Found object or null
   */
  findInGroups(objectId) {
    // Check top level first
    const topLevel = this.getById(objectId)
    if (topLevel) return topLevel

    // Recursively search in groups
    for (const obj of this.objects) {
      if (obj.type === 'group' || obj.svg_element === 'g') {
        const found = this.findInGroupChildren(obj, objectId)
        if (found) return found
      }
    }
    return null
  }

  /**
   * Recursively search for an object in a group's children.
   * @param {object} group - Group to search
   * @param {string} objectId - ID to find
   * @returns {object|null} Found object or null
   * @private
   */
  findInGroupChildren(group, objectId) {
    if (!group.children || !Array.isArray(group.children)) return null

    for (const child of group.children) {
      if (child.id === objectId) {
        return child
      }
      // Recursively search nested groups
      if (child.type === 'group' || child.svg_element === 'g') {
        const found = this.findInGroupChildren(child, objectId)
        if (found) return found
      }
    }
    return null
  }

  /**
   * Remove an object from any group it might be in.
   * @param {string} objectId - ID of object to remove
   * @private
   */
  _removeFromAnyGroup(objectId) {
    for (const obj of this.objects) {
      if (obj.type === 'group' || obj.svg_element === 'g') {
        this._removeFromGroupChildren(obj, objectId)
      }
    }
  }

  /**
   * Recursively remove an object from a group's children.
   * @param {object} group - Group to search
   * @param {string} objectId - ID to remove
   * @returns {boolean} True if removed
   * @private
   */
  _removeFromGroupChildren(group, objectId) {
    if (!group.children || !Array.isArray(group.children)) return false

    const index = group.children.findIndex(child => child.id === objectId)
    if (index !== -1) {
      group.children.splice(index, 1)
      return true
    }

    // Recursively search nested groups
    for (const child of group.children) {
      if (child.type === 'group' || child.svg_element === 'g') {
        if (this._removeFromGroupChildren(child, objectId)) {
          return true
        }
      }
    }
    return false
  }

  /**
   * Check if an object is a descendant of another (for circular reference prevention).
   * @param {string} ancestorId - Potential ancestor ID
   * @param {string} descendantId - Potential descendant ID
   * @returns {boolean} True if descendantId is a descendant of ancestorId
   * @private
   */
  _isDescendantOf(ancestorId, descendantId) {
    const ancestor = this.getById(ancestorId)
    if (!ancestor || (ancestor.type !== 'group' && ancestor.svg_element !== 'g')) {
      return false
    }

    const checkChildren = (group) => {
      if (!group.children || !Array.isArray(group.children)) return false
      for (const child of group.children) {
        if (child.id === descendantId) return true
        if (child.type === 'group' || child.svg_element === 'g') {
          if (checkChildren(child)) return true
        }
      }
      return false
    }

    return checkChildren(ancestor)
  }

  /**
   * Get all groups (flat list, including nested).
   * @returns {Array} Array of all groups
   */
  getAllGroups() {
    const groups = []
    const collectGroups = (items) => {
      for (const item of items) {
        if (item.type === 'group' || item.svg_element === 'g') {
          groups.push(item)
          if (item.children && Array.isArray(item.children)) {
            collectGroups(item.children)
          }
        }
      }
    }
    collectGroups(this.objects)
    return groups
  }
}

