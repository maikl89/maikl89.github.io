/**
 * Projects Panel - UI for managing projects
 * Allows creating, loading, and managing multiple projects.
 */

import { createPanel } from '../components/Panel.js'
import { createButton } from '../components/Button.js'

export class ProjectsPanel {
  /**
   * Create a projects panel.
   * @param {object} options - Panel options
   * @param {ProjectManager} options.projectManager - Project manager instance
   * @param {Function} options.onProjectChange - Callback when project changes
   */
  constructor({
    projectManager,
    onProjectChange = () => {},
    onUploadProject = () => {},
    onImportFirebaseConfig = () => {},
    canUpload = false,
    isUploading = false
  } = {}) {
    if (!projectManager) {
      throw new Error('ProjectManager is required')
    }
    
    this.projectManager = projectManager
    this.onProjectChange = onProjectChange
    this.onUploadProject = onUploadProject
    this.onImportFirebaseConfig = onImportFirebaseConfig
    this.canUpload = canUpload
    this.isUploading = isUploading
    this.root = null
    this.list = null
    
    // Subscribe to project changes
    this.projectManager.subscribe(() => {
      this._refresh()
    })
  }

  /**
   * Update upload options (e.g., enabled state or loading indicator).
   * @param {object} options
   * @param {boolean} [options.canUpload]
   * @param {boolean} [options.isUploading]
   */
  setUploadOptions({ canUpload, isUploading } = {}) {
    if (typeof canUpload === 'boolean') {
      this.canUpload = canUpload
    }
    if (typeof isUploading === 'boolean') {
      this.isUploading = isUploading
    }
    this._refresh()
  }

  /**
   * Render the projects panel.
   * @returns {HTMLElement} Panel element
   */
  render() {
    const container = document.createElement('div')
    container.classList.add('projects-panel')

    // Current project display
    const currentSection = document.createElement('div')
    currentSection.classList.add('projects-panel__current')
    
    const currentLabel = document.createElement('label')
    currentLabel.textContent = 'Current Project'
    currentLabel.style.marginBottom = '0.5rem'
    currentLabel.style.display = 'block'
    currentLabel.style.fontSize = '0.75rem'
    currentLabel.style.color = 'var(--text-secondary)'
    
    const currentProject = this.projectManager.getCurrent()
    const currentTitle = document.createElement('div')
    currentTitle.classList.add('projects-panel__current-title')
    currentTitle.textContent = currentProject ? currentProject.title : 'No project'
    currentTitle.style.fontWeight = '600'
    currentTitle.style.marginBottom = '0.5rem'
    
    const unsavedIndicator = document.createElement('div')
    unsavedIndicator.classList.add('projects-panel__unsaved')
    unsavedIndicator.textContent = this.projectManager.hasChanges() ? '● Unsaved changes' : '✓ Saved'
    unsavedIndicator.style.fontSize = '0.7rem'
    unsavedIndicator.style.color = this.projectManager.hasChanges() ? '#fbbf24' : 'var(--text-secondary)'
    
    currentSection.appendChild(currentLabel)
    currentSection.appendChild(currentTitle)
    currentSection.appendChild(unsavedIndicator)

    // Projects list
    const listSection = document.createElement('div')
    listSection.classList.add('projects-panel__list')
    listSection.style.marginTop = '1rem'
    
    const listLabel = document.createElement('label')
    listLabel.textContent = 'All Projects'
    listLabel.style.marginBottom = '0.5rem'
    listLabel.style.display = 'block'
    listLabel.style.fontSize = '0.75rem'
    listLabel.style.color = 'var(--text-secondary)'
    
    this.list = document.createElement('ul')
    this.list.classList.add('projects-list')
    this.list.style.listStyle = 'none'
    this.list.style.padding = '0'
    this.list.style.margin = '0'
    this.list.style.display = 'flex'
    this.list.style.flexDirection = 'column'
    this.list.style.gap = '0.25rem'
    
    this._renderProjectsList()
    
    listSection.appendChild(listLabel)
    listSection.appendChild(this.list)

    // Actions
    const actionsSection = document.createElement('div')
    actionsSection.classList.add('projects-panel__actions')
    actionsSection.style.marginTop = '1rem'
    actionsSection.style.display = 'flex'
    actionsSection.style.flexDirection = 'column'
    actionsSection.style.gap = '0.5rem'
    
    const firebaseConfigInput = document.createElement('input')
    firebaseConfigInput.type = 'file'
    firebaseConfigInput.accept = 'application/json'
    firebaseConfigInput.style.display = 'none'
    firebaseConfigInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const config = JSON.parse(text)
        const databaseUrl =
          typeof config.databaseUrl === 'string' ? config.databaseUrl.trim() : ''

        if (!databaseUrl) {
          window.alert?.('Invalid Firebase config: "databaseUrl" is required.')
        } else {
          this.onImportFirebaseConfig({ databaseUrl })
        }
      } catch (error) {
        console.error('Failed to parse Firebase config file', error)
        window.alert?.(
          'Failed to read Firebase config. Please provide a valid JSON with "databaseUrl".'
        )
      } finally {
        event.target.value = ''
      }
    })

    actionsSection.appendChild(firebaseConfigInput)

    const loadFirebaseBtn = createButton({
      label: 'Load Firebase Config',
      variant: 'ghost',
      onClick: () => firebaseConfigInput.click()
    })

    const newProjectBtn = createButton({
      label: 'New Project',
      variant: 'primary',
      onClick: () => this._createNewProject()
    })
    
    const saveBtn = createButton({
      label: 'Save Current',
      variant: 'ghost',
      onClick: () => {
        this.projectManager.forceSave()
        this._refresh()
      },
      disabled: !this.projectManager.hasChanges()
    })
    
    const renameBtn = createButton({
      label: 'Rename Project',
      variant: 'ghost',
      onClick: () => this._renameCurrentProject(),
      disabled: !currentProject
    })
    
    actionsSection.appendChild(newProjectBtn)
    actionsSection.appendChild(renameBtn)
    actionsSection.appendChild(saveBtn)
    actionsSection.appendChild(loadFirebaseBtn)

    if (this.canUpload) {
      const uploadBtn = createButton({
        label: this.isUploading ? 'Uploading…' : 'Upload to Firebase',
        variant: 'ghost',
        onClick: () => {
          if (this.isUploading) return
          this.onUploadProject()
        },
        disabled: this.isUploading
      })
      actionsSection.appendChild(uploadBtn)
    } else {
      const helper = document.createElement('p')
      helper.style.margin = '0'
      helper.style.fontSize = '0.7rem'
      helper.style.color = 'var(--text-secondary)'
      helper.textContent = 'Configure Firebase to enable uploads.'
      actionsSection.appendChild(helper)
    }

    container.appendChild(currentSection)
    container.appendChild(listSection)
    container.appendChild(actionsSection)

    this.root = createPanel({
      title: 'Projects',
      content: container
    })

    return this.root
  }

  /**
   * Render the projects list.
   * @private
   */
  _renderProjectsList() {
    if (!this.list) return
    
    this.list.innerHTML = ''
    
    const projects = this.projectManager.getAll()
    const currentId = this.projectManager.currentProjectId
    
    if (projects.length === 0) {
      const empty = document.createElement('li')
      empty.textContent = 'No projects yet'
      empty.style.color = 'var(--text-secondary)'
      empty.style.fontSize = '0.75rem'
      empty.style.padding = '0.5rem'
      this.list.appendChild(empty)
      return
    }
    
    projects.forEach(project => {
      const item = document.createElement('li')
      item.classList.add('projects-list__item')
      item.style.padding = '0.5rem'
      item.style.borderRadius = 'var(--radius-md)'
      item.style.cursor = 'pointer'
      item.style.display = 'flex'
      item.style.justifyContent = 'space-between'
      item.style.alignItems = 'center'
      item.style.gap = '0.5rem'
      
      if (project.id === currentId) {
        item.style.background = 'var(--accent-soft)'
        item.style.border = '1px solid var(--accent)'
      } else {
        item.style.background = 'transparent'
        item.style.border = '1px solid transparent'
      }
      
      item.addEventListener('mouseenter', () => {
        if (project.id !== currentId) {
          item.style.background = 'var(--muted)'
        }
      })
      
      item.addEventListener('mouseleave', () => {
        if (project.id !== currentId) {
          item.style.background = 'transparent'
        }
      })
      
      const title = document.createElement('div')
      title.textContent = project.title
      title.style.flex = '1'
      title.style.fontSize = '0.8rem'
      title.style.overflow = 'hidden'
      title.style.textOverflow = 'ellipsis'
      title.style.whiteSpace = 'nowrap'
      
      const assetCount = document.createElement('div')
      assetCount.textContent = `${project.assets?.length || 0} assets`
      assetCount.style.fontSize = '0.7rem'
      assetCount.style.color = 'var(--text-secondary)'
      
      const actions = document.createElement('div')
      actions.style.display = 'flex'
      actions.style.gap = '0.25rem'
      
      if (project.id !== currentId) {
        const loadBtn = document.createElement('button')
        loadBtn.textContent = 'Load'
        loadBtn.classList.add('ui-btn', 'ui-btn--ghost')
        loadBtn.style.fontSize = '0.7rem'
        loadBtn.style.padding = '0.25rem 0.5rem'
        loadBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          this._loadProject(project.id)
        })
        actions.appendChild(loadBtn)
      }
      
      const deleteBtn = document.createElement('button')
      deleteBtn.textContent = '×'
      deleteBtn.classList.add('ui-btn', 'ui-btn--ghost')
      deleteBtn.style.fontSize = '1rem'
      deleteBtn.style.padding = '0.25rem 0.5rem'
      deleteBtn.style.width = '24px'
      deleteBtn.style.height = '24px'
      deleteBtn.style.lineHeight = '1'
      deleteBtn.disabled = projects.length === 1 // Can't delete last project
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        if (confirm(`Delete "${project.title}"?`)) {
          this.projectManager.deleteProject(project.id)
        }
      })
      actions.appendChild(deleteBtn)
      
      item.appendChild(title)
      item.appendChild(assetCount)
      item.appendChild(actions)
      
      item.addEventListener('click', () => {
        if (project.id !== currentId) {
          this._loadProject(project.id)
        }
      })
      
      this.list.appendChild(item)
    })
  }

  /**
   * Rename current project.
   * @private
   */
  _renameCurrentProject() {
    const current = this.projectManager.getCurrent()
    if (!current) {
      window.alert?.('No project selected to rename.')
      return
    }

    const nextTitle = prompt('Rename project:', current.title || 'Untitled Project')
    if (nextTitle === null) return

    const trimmed = nextTitle.trim()
    if (!trimmed) {
      window.alert?.('Project title cannot be empty.')
      return
    }

    const updated = this.projectManager.renameProject(current.id, trimmed)
    if (updated) {
      this.onProjectChange(updated)
      this._refresh()
    }
  }

  /**
   * Create a new project.
   * @private
   */
  _createNewProject() {
    const title = prompt('Enter project title:', 'Untitled Project')
    if (title === null) return // User cancelled
    
    const project = this.projectManager.createProject(title.trim() || 'Untitled Project', true)
    this.onProjectChange(project)
    this._refresh()
  }

  /**
   * Load a project.
   * @param {string} projectId - Project ID
   * @private
   */
  _loadProject(projectId) {
    const loaded = this.projectManager.loadProject(projectId)
    if (loaded) {
      const project = this.projectManager.getCurrent()
      this.onProjectChange(project)
      this._refresh()
    }
  }

  /**
   * Refresh the panel.
   * @private
   */
  _refresh() {
    if (!this.root) return

    const parent = this.root.parentElement
    const previousRoot = this.root
    const newPanel = this.render()
    if (parent) {
      parent.replaceChild(newPanel, previousRoot)
    }
  }
}

