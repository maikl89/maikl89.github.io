// /**
//  * Project Manager - Manages multiple projects stored in Firebase (when configured).
//  * Falls back to in-memory defaults if Firebase is not configured.
//  */

// import { isArray, isObject, validateId } from '../../utils/validation.js'

// export class ProjectManager {
//   constructor(options = {}) {
//     this.firebaseClient = options.firebaseClient || null
//     this.projects = []
//     this.currentProjectId = null
//     this.hasUnsavedChanges = false
//     this.listeners = new Set()

//     this.autoSaveDelay = options.autoSaveDelay || 1000
//     this.saveTimeout = null

//     this.initialized = false
//     this.initializePromise = this._initialize()
//   }

//   async _initialize() {
//     if (this.firebaseClient?.isConfigured()) {
//       try {
//         const projects = await this.firebaseClient.fetchProjects()
//         if (isArray(projects) && projects.length > 0) {
//           this.projects = projects
//         }
//       } catch (error) {
//         console.warn('Failed to load projects from Firebase:', error)
//       }
//     }

//     if (!Array.isArray(this.projects) || this.projects.length === 0) {
//       this.projects = [this._createProjectObject('Untitled Project')]
//     }

//     if (!this.currentProjectId && this.projects.length > 0) {
//       this.currentProjectId = this.projects[0].id
//     }

//     this.hasUnsavedChanges = false
//     this.initialized = true
//     this._notify()
//   }

//   initialize() {
//     return this.initializePromise
//   }

//   subscribe(callback) {
//     this.listeners.add(callback)
//     return () => this.listeners.delete(callback)
//   }

//   _notify() {
//     this.listeners.forEach((callback) => {
//       try {
//         callback({
//           projects: this.projects,
//           currentProjectId: this.currentProjectId,
//           hasUnsavedChanges: this.hasUnsavedChanges
//         })
//       } catch (error) {
//         console.warn('Project listener error:', error)
//       }
//     })
//   }

//   _createProjectObject(title) {
//     const date = new Date()
//     const formatted =
//       date.getFullYear() +
//       '_' +
//       String(date.getMonth() + 1).padStart(2, '0') +
//       '_' +
//       String(date.getDate()).padStart(2, '0')
//     return {
//       id: `project_${formatted}_${Math.random().toString(36).substr(2, 9)}`,
//       title: title.trim() || 'Untitled Project',
//       assets: [],
//       createdAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString()
//     }
//   }

//   scheduleSave() {
//     if (this.saveTimeout) {
//       clearTimeout(this.saveTimeout)
//     }

//     this.hasUnsavedChanges = true
//     this._notify()

//     this.saveTimeout = setTimeout(() => {
//       this.save()
//     }, this.autoSaveDelay)
//   }

//   getAll() {
//     return [...this.projects]
//   }

//   getById(id) {
//     if (!validateId(id)) return null
//     return this.projects.find((p) => p.id === id) || null
//   }

//   getCurrent() {
//     if (!this.currentProjectId) return null
//     return this.getById(this.currentProjectId)
//   }

//   getCurrentAssets() {
//     const project = this.getCurrent()
//     if (!project) return []
//     return isArray(project.assets) ? [...project.assets] : []
//   }

//   createProject(title = 'Untitled Project', setAsCurrent = true) {
//     const project = this._createProjectObject(title)
//     this.projects.push(project)

//     if (setAsCurrent) {
//       this.currentProjectId = project.id
//     }

//     this._persistProject(project).catch((error) => {
//       console.warn('Failed to persist project to Firebase:', error)
//     })
//     this._notify()

//     return project
//   }

//   updateProject(id, updates) {
//     if (!validateId(id)) return null
//     if (!isObject(updates)) {
//       throw new Error('Updates must be a valid object')
//     }

//     const project = this.getById(id)
//     if (!project) return null

//     if ('assets' in updates) {
//       delete updates.assets
//     }

//     Object.assign(project, updates)
//     project.updatedAt = new Date().toISOString()

//     this._persistProject(project).catch((error) => {
//       console.warn('Failed to update project in Firebase:', error)
//     })
//     this._notify()

//     return project
//   }

//   updateCurrentAssets(assets) {
//     if (!isArray(assets)) {
//       throw new Error('Assets must be an array')
//     }

//     const project = this.getCurrent()
//     if (!project) {
//       this.createProject('Untitled Project', true)
//       return this.updateCurrentAssets(assets)
//     }

//     project.assets = assets
//     project.updatedAt = new Date().toISOString()

//     this.scheduleSave()
//     this._notify()
//   }

//   loadProject(id) {
//     if (!validateId(id)) return false

//     const project = this.getById(id)
//     if (!project) return false

//     if (this.hasUnsavedChanges) {
//       this.save()
//     }

//     this.currentProjectId = id
//     this.hasUnsavedChanges = false
//     this._notify()

//     return true
//   }

//   deleteProject(id) {
//     if (!validateId(id)) return false

//     const index = this.projects.findIndex((p) => p.id === id)
//     if (index === -1) return false

//     if (this.projects.length === 1) {
//       return false
//     }

//     this.projects.splice(index, 1)

//     if (this.currentProjectId === id) {
//       this.currentProjectId =
//         this.projects.length > 0 ? this.projects[0].id : null
//     }

//     this._deleteProjectRemote(id).catch((error) => {
//       console.warn('Failed to delete project from Firebase:', error)
//     })
//     this._notify()

//     return true
//   }

//   duplicateProject(id) {
//     if (!validateId(id)) return null

//     const project = this.getById(id)
//     if (!project) return null

//     const duplicated = {
//       id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
//       title: `${project.title} (Copy)`,
//       assets: JSON.parse(JSON.stringify(project.assets)),
//       createdAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString()
//     }

//     this.projects.push(duplicated)
//     this._persistProject(duplicated).catch((error) => {
//       console.warn('Failed to persist duplicated project to Firebase:', error)
//     })
//     this._notify()

//     return duplicated
//   }

//   hasChanges() {
//     return this.hasUnsavedChanges
//   }

//   async forceSave() {
//     this.hasUnsavedChanges = true
//     await this.save()
//   }

//   clear() {
//     this.projects = []
//     this.currentProjectId = null
//     this.hasUnsavedChanges = false
//     this._notify()
//   }

//   async save() {
//     if (!this.hasUnsavedChanges) {
//       return false
//     }
//     try {
//       await this._persistCurrentProject()
//       this.hasUnsavedChanges = false
//       this._notify()
//       return true
//     } catch (error) {
//       console.warn('Failed to save project to Firebase:', error)
//       return false
//     }
//   }

//   async _persistCurrentProject() {
//     const project = this.getCurrent()
//     if (!project) return false
//     await this._persistProject(project)
//     return true
//   }

//   async _persistProject(project) {
//     if (this.firebaseClient?.isConfigured()) {
//       await this.firebaseClient.uploadProject(project)
//     }
//   }

//   async _deleteProjectRemote(projectId) {
//     if (this.firebaseClient?.isConfigured()) {
//       await this.firebaseClient.deleteProject(projectId)
//     }
//   }
// }

// export default ProjectManager
