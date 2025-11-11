/**
 * Project Manager - Manages multiple projects
 * Each project contains assets (objects/groups) and metadata.
 */

import { StorageManager } from '../../utils/storage.js'
import { isArray, isObject, isString, validateId } from '../../utils/validation.js'

export class ProjectManager {
  /**
   * Create a project manager.
   * @param {object} options - Project manager options
   */
  constructor(options = {}) {
    this.storage = new StorageManager('preview2')
    this.storageKey = options.storageKey || 'preview2-projects'
    this.currentProjectId = null
    this.projects = []
    this.hasUnsavedChanges = false
    this.listeners = new Set()

    // Load projects from storage
    this.load()

    // Auto-save debounce
    this.saveTimeout = null
    this.autoSaveDelay = options.autoSaveDelay || 1000
  }

  /**
   * Subscribe to project changes.
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Notify all listeners of changes.
   * @private
   */
  _notify() {
    this.listeners.forEach((callback) => {
      try {
        callback({
          projects: this.projects,
          currentProjectId: this.currentProjectId,
          hasUnsavedChanges: this.hasUnsavedChanges
        })
      } catch (error) {
        console.warn('Project listener error:', error)
      }
    })
  }

  /**
   * Generate a unique project ID.
   * @returns {string} Unique ID
   * @private
   */
  _generateId() {
    const date = new Date()
    const formatted =
      date.getFullYear() +
      '_' +
      String(date.getMonth() + 1).padStart(2, '0') +
      '_' +
      String(date.getDate()).padStart(2, '0')
    return `project_${formatted}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Load projects from storage.
   */
  load() {
    const stored = this.storage.get(this.storageKey)

    if (isArray(stored)) {
      // Legacy format: array of projects only
      this.projects = stored
    } else if (isObject(stored) && isArray(stored.projects)) {
      this.projects = stored.projects
      if (typeof stored.currentProjectId === 'string') {
        this.currentProjectId = stored.currentProjectId
      }
    } else if (stored !== null && stored !== undefined) {
      console.warn('Invalid projects data in storage, initializing empty')
      this.projects = []
    } else {
      this.projects = []
    }

    if (this.projects.length === 0) {
      this.createProject('Untitled Project', true)
      return
    }

    const hasValidCurrentProject = this.projects.some(
      (project) => project.id === this.currentProjectId
    )

    if (!hasValidCurrentProject) {
      this.currentProjectId = this.projects[0]?.id || null
    }

    this.hasUnsavedChanges = false
  }

  /**
   * Save projects to storage (only if changed).
   */
  save() {
    if (!this.hasUnsavedChanges) {
      return false
    }

    const saved = this._persistState()
    if (saved) {
      this.hasUnsavedChanges = false
      this._notify()
    }
    return saved
  }

  /**
   * Serialize project state for persistence.
   * @returns {{projects: Array, currentProjectId: string|null}}
   * @private
   */
  _serialize() {
    return {
      projects: this.projects,
      currentProjectId: this.currentProjectId
    }
  }

  /**
   * Persist project state to storage.
   * @returns {boolean} Success status
   * @private
   */
  _persistState() {
    return this.storage.set(this.storageKey, this._serialize())
  }

  /**
   * Schedule auto-save (debounced).
   */
  scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    this.hasUnsavedChanges = true
    this._notify()

    this.saveTimeout = setTimeout(() => {
      this.save()
    }, this.autoSaveDelay)
  }

  /**
   * Get all projects.
   * @returns {Array} Array of projects
   */
  getAll() {
    return [...this.projects]
  }

  /**
   * Get project by ID.
   * @param {string} id - Project ID
   * @returns {object|null} Project or null
   */
  getById(id) {
    if (!validateId(id)) return null
    return this.projects.find((p) => p.id === id) || null
  }

  /**
   * Get current project.
   * @returns {object|null} Current project or null
   */
  getCurrent() {
    if (!this.currentProjectId) return null
    return this.getById(this.currentProjectId)
  }

  /**
   * Get current project assets.
   * @returns {Array} Array of assets (objects/groups)
   */
  getCurrentAssets() {
    const project = this.getCurrent()
    if (!project) return []
    return isArray(project.assets) ? [...project.assets] : []
  }

  /**
   * Create a new project.
   * @param {string} title - Project title
   * @param {boolean} setAsCurrent - Set as current project
   * @returns {object} Created project
   */
  createProject(title = 'Untitled Project', setAsCurrent = true) {
    const project = {
      id: this._generateId(),
      title: title.trim() || 'Untitled Project',
      assets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.projects.push(project)

    if (setAsCurrent) {
      this.currentProjectId = project.id
    }

    this.scheduleSave()
    this._notify()

    return project
  }

  /**
   * Update project metadata.
   * @param {string} id - Project ID
   * @param {object} updates - Partial project updates
   * @returns {object|null} Updated project or null
   */
  updateProject(id, updates) {
    if (!validateId(id)) return null
    if (!isObject(updates)) {
      throw new Error('Updates must be a valid object')
    }

    const project = this.getById(id)
    if (!project) return null

    // Don't allow updating assets through this method (use updateAssets instead)
    if ('assets' in updates) {
      delete updates.assets
    }

    Object.assign(project, updates)
    project.updatedAt = new Date().toISOString()

    this.scheduleSave()
    this._notify()
    this._persistState()

    return project
  }

  /**
   * Rename a project.
   * @param {string} id - Project ID
   * @param {string} title - New project title
   * @returns {object|null} Updated project or null
   */
  renameProject(id, title) {
    if (!validateId(id)) return null
    if (!isString(title)) {
      throw new Error('Title must be a string')
    }

    const trimmed = title.trim()
    if (!trimmed) {
      throw new Error('Project title cannot be empty')
    }

    return this.updateProject(id, { title: trimmed })
  }

  /**
   * Rename the current project.
   * @param {string} title - New title
   * @returns {object|null} Updated project or null
   */
  renameCurrentProject(title) {
    if (!this.currentProjectId) return null
    return this.renameProject(this.currentProjectId, title)
  }

  /**
   * Update current project assets.
   * @param {Array} assets - Array of assets
   */
  updateCurrentAssets(assets) {
    if (!isArray(assets)) {
      throw new Error('Assets must be an array')
    }

    const project = this.getCurrent()
    if (!project) {
      // Create default project if none exists
      this.createProject('Untitled Project', true)
      return this.updateCurrentAssets(assets)
    }

    project.assets = assets
    project.updatedAt = new Date().toISOString()

    this.scheduleSave()
    this._notify()
  }

  /**
   * Load a project (set as current).
   * @param {string} id - Project ID
   * @returns {boolean} Success status
   */
  loadProject(id) {
    if (!validateId(id)) return false

    const project = this.getById(id)
    if (!project) return false

    // Save current project if it has changes
    if (this.hasUnsavedChanges) {
      this.save()
    }

    this.currentProjectId = id
    this.hasUnsavedChanges = false
    this._notify()
    this._persistState()

    return true
  }

  /**
   * Delete a project.
   * @param {string} id - Project ID
   * @returns {boolean} Success status
   */
  deleteProject(id) {
    if (!validateId(id)) return false

    const index = this.projects.findIndex((p) => p.id === id)
    if (index === -1) return false

    // Don't allow deleting if it's the only project
    if (this.projects.length === 1) {
      return false
    }

    this.projects.splice(index, 1)

    // If deleted project was current, switch to first available
    if (this.currentProjectId === id) {
      this.currentProjectId =
        this.projects.length > 0 ? this.projects[0].id : null
    }

    this.scheduleSave()
    this._notify()

    return true
  }

  /**
   * Duplicate a project.
   * @param {string} id - Project ID to duplicate
   * @returns {object|null} Duplicated project or null
   */
  duplicateProject(id) {
    if (!validateId(id)) return null

    const project = this.getById(id)
    if (!project) return null

    const duplicated = {
      id: this._generateId(),
      title: `${project.title} (Copy)`,
      assets: JSON.parse(JSON.stringify(project.assets)), // Deep clone
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.projects.push(duplicated)
    this.scheduleSave()
    this._notify()

    return duplicated
  }

  /**
   * Check if there are unsaved changes.
   * @returns {boolean} True if unsaved changes exist
   */
  hasChanges() {
    return this.hasUnsavedChanges
  }

  /**
   * Force save (bypass change tracking).
   */
  forceSave() {
    this.hasUnsavedChanges = true
    this.save()
  }

  /**
   * Clear all projects (use with caution).
   */
  clear() {
    this.projects = []
    this.currentProjectId = null
    this.hasUnsavedChanges = false
    this.storage.remove(this.storageKey)
    this._notify()
  }
}
