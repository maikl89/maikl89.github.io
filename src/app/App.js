import { AnimationEngine } from '../core/animation/AnimationEngine.js'
import { TimelineController } from '../core/animation/TimelineController.js'
import { CollectionManager } from '../core/collection/CollectionManager.js'
import { InteractionManager } from '../core/interaction/InteractionManager.js'
import { ProjectManager } from '../core/projects/ProjectManager.js'
import { Camera } from '../core/rendering/Camera.js'
import { CanvasRenderer } from '../core/rendering/CanvasRenderer.js'
import { SVGRenderer } from '../core/rendering/SVGRenderer.js'
import { InferenceClient } from '../features/ai/InferenceClient.js'
import { LoRATrainingManager } from '../features/ai/LoRATrainingManager.js'
import { SemanticModuleSelector } from '../features/ai/SemanticModuleSelector.js'
import { ContextGenerator } from '../features/context/ContextGenerator.js'
import { ModifierGenerator } from '../features/context/ModifierGenerator.js'
import { PoseDetectionService } from '../features/pose/PoseDetectionService.js'
import { PoseToObject } from '../features/pose/PoseToObject.js'
import { PoseVisualizer } from '../features/pose/PoseVisualizer.js'
import FirebaseClient from '../services/api/FirebaseClient.js'
import { createButton } from '../ui/components/Button.js'
import { createPanel } from '../ui/components/Panel.js'
import { Ruler } from '../ui/components/Ruler.js'
import { CollectionPanel } from '../ui/panels/CollectionPanel.js'
import { ProjectsPanel } from '../ui/panels/ProjectsPanel.js'
import { PropertiesPanel } from '../ui/panels/PropertiesPanel.js'
import { SettingsPanel } from '../ui/panels/SettingsPanel.js'
import { TimelinePanel } from '../ui/panels/TimelinePanel.js'
import { round } from '../utils/math.js'
import DEFAULT_CONFIG, { createConfig } from './config.js'

export default class App {
  constructor(options = {}) {
    this.options = options
    this.root = null

    this.config = createConfig(options.config || {})
    const firebaseConfig = this.config.firebase || {}
    this.firebaseClient = new FirebaseClient({
      databaseUrl: firebaseConfig.databaseUrl,
      authToken: firebaseConfig.authToken
    })
    this.isUploadingProject = false

    this.baseControls = JSON.parse(
      JSON.stringify(DEFAULT_CONFIG.controls || {})
    )
    this.controlScale = 1
    this.config.controls = { ...this.baseControls }

    // would be enabled later
    // this.inferenceClient = new InferenceClient({
    //   baseUrl: this.config.api.baseUrl,
    //   timeout: this.config.api.timeout
    // })
    // this.trainingManager = new LoRATrainingManager({ client: this.inferenceClient })
    // this.moduleSelector = new SemanticModuleSelector()
    // this.poseService = new PoseDetectionService({ client: this.inferenceClient })
    // this.poseToObject = new PoseToObject()
    // this.contextGenerator = new ContextGenerator()
    // this.modifierGenerator = new ModifierGenerator()

    this.projectManager = new ProjectManager({})
    this.collectionManager = new CollectionManager({
      projectManager: this.projectManager
    })
    this.camera = new Camera({ z: DEFAULT_CONFIG.defaultZoom })
    this.animationEngine = new AnimationEngine()
    this.timelineController = new TimelineController(this.animationEngine)

    this.svgRenderer = null
    this.canvasRenderer = null
    this.poseVisualizer = null
    this.interactionManager = null
    this.horizontalRuler = null
    this.verticalRuler = null

    this.labelPrefixCounters = new Map()
    this.currentLabelPrefixKey = ''

    this.collectionPanel = null
    this.collectionPanelRoot = null
    this.propertiesPanel = null
    this.propertiesPanelRoot = null
    this.settingsPanel = null
    this.settingsPanelRoot = null
    this.timelinePanel = null
    this.stageRoot = null

    this.selectedObject = null
    this.activeHandle = null // Track active control point being dragged

    // Overlay image state
    this.overlayImage = {
      url: null,
      opacity: 0.5,
      visible: false,
      position: { x: 0, y: 0 },
      scale: 1,
      fileName: null,
      labelPrefix: ''
    }

    this.collectionManager.subscribe(() => {
      this._refreshCollectionPanel()
      this.renderScene()
    })
  }

  mount(root) {
    if (!root)
      throw new Error('Root element is required to mount the application.')

    this.root = typeof root === 'string' ? document.querySelector(root) : root
    if (!this.root)
      throw new Error('Could not find root element for Preview2 app.')

    this.root.classList.add('preview2-app')
    this.root.innerHTML = ''

    this._buildLayout()
    this.renderScene()
  }

  _buildLayout() {
    const shell = document.createElement('div')
    shell.classList.add('app-shell')

    const header = document.createElement('header')
    header.classList.add('app-header')
    // header.innerHTML = `<h1>Preview2</h1><p>Core systems wired. Feature integration in progress.</p>`

    const main = document.createElement('main')
    main.classList.add('app-main')

    const layout = document.createElement('div')
    layout.classList.add('app-layout')

    const sidebar = document.createElement('aside')
    sidebar.classList.add('app-sidebar')

    this.collectionPanel = new CollectionPanel({
      manager: this.collectionManager,
      onSelect: (obj) => this._selectObject(obj),
      onCreate: () => this._createPlaceholderObject(),
      onCreateGroup: () => this._createPlaceholderGroup(),
      onAssignToGroup: (objectId, groupId) =>
        this._assignToGroup(objectId, groupId),
      onDuplicate: (id) => this._duplicateObject(id),
      onDelete: (id) => this._deleteObject(id),
      onReset: () => this._resetCollection(),
      onExport: () => this._exportCollection()
    })
    this.collectionPanelRoot = this.collectionPanel.render()

    this.propertiesPanel = new PropertiesPanel({
      onChange: (updates) => this._updateSelectedObject(updates),
      onAddNode: () => this._addNodeToSelectedObject()
    })
    this.propertiesPanelRoot = this.propertiesPanel.render()

    this.settingsPanel = new SettingsPanel({
      controlScale: this.controlScale,
      onControlScaleChange: (value) => this._updateControlScale(value),
      onZoomIn: () => this._handleZoomIn(),
      onZoomOut: () => this._handleZoomOut()
    })
    this.settingsPanelRoot = this.settingsPanel.render()

    this.projectsPanel = new ProjectsPanel({
      projectManager: this.projectManager,
      onProjectChange: (project) => {
        // Refresh collection when project changes
        this._refreshCollectionPanel()
        this.renderScene()
        // Clear selection when switching projects
        this._selectObject(null)
      },
      onUploadProject: () => this._uploadCurrentProject(),
      onImportFirebaseConfig: (config) => this._applyFirebaseConfig(config),
      canUpload: this.firebaseClient?.isConfigured(),
      isUploading: this.isUploadingProject
    })
    this.projectsPanelRoot = this.projectsPanel.render()

    this.timelinePanel = new TimelinePanel({
      onPlayPause: () => {
        if (this.animationEngine.isPlaying) {
          this.animationEngine.pause()
        } else {
          this.animationEngine.play()
        }
      },
      onStop: () => this.animationEngine.stop()
    })

    sidebar.appendChild(this.projectsPanelRoot)
    sidebar.appendChild(this.collectionPanelRoot)
    sidebar.appendChild(this.propertiesPanelRoot)
    sidebar.appendChild(this.settingsPanelRoot)
    sidebar.appendChild(this._createOverlayImagePanel())
    sidebar.appendChild(this.timelinePanel.render())

    const stage = document.createElement('section')
    stage.classList.add('app-stage')
    stage.style.width = '100%'
    stage.style.height = '100%'
    this.stageRoot = stage

    // Create ruler container
    const rulerContainer = document.createElement('div')
    rulerContainer.classList.add('app-stage__rulers')
    rulerContainer.style.position = 'relative'
    rulerContainer.style.width = '100%'
    rulerContainer.style.height = '100%'

    // Image overlay for reference (behind SVG)
    const imageOverlay = document.createElement('img')
    imageOverlay.classList.add('app-stage__image-overlay')
    imageOverlay.style.display = 'none'
    this.imageOverlay = imageOverlay

    const svgContainer = document.createElement('div')
    svgContainer.classList.add('app-stage__svg')

    const canvasOverlay = document.createElement('canvas')
    canvasOverlay.classList.add('app-stage__overlay')

    // Create rulers
    this.horizontalRuler = new Ruler({
      container: rulerContainer,
      orientation: 'horizontal',
      size: 20
    })

    this.verticalRuler = new Ruler({
      container: rulerContainer,
      orientation: 'vertical',
      size: 20
    })

    stage.appendChild(rulerContainer)
    rulerContainer.appendChild(imageOverlay)
    rulerContainer.appendChild(svgContainer)
    rulerContainer.appendChild(canvasOverlay)

    layout.appendChild(sidebar)
    layout.appendChild(stage)
    main.appendChild(layout)

    shell.appendChild(header)
    shell.appendChild(main)
    this.root.appendChild(shell)

    this.svgRenderer = new SVGRenderer(svgContainer, {
      width: svgContainer.clientWidth || this.config.stage?.width || 1920,
      height: svgContainer.clientHeight || this.config.stage?.height || 1080,
      controls: this.config.controls
    })
    this.svgRenderer.init()
    this.svgRenderer.setControlsConfig(this.config.controls)

    this.canvasRenderer = new CanvasRenderer(svgContainer, {
      width: svgContainer.clientWidth || this.config.stage?.width || 1920,
      height: svgContainer.clientHeight || this.config.stage?.height || 1080
    })

    this.poseVisualizer = new PoseVisualizer(canvasOverlay)
    this._resizeStage()

    // Initialize interaction manager
    this.interactionManager = new InteractionManager({
      container: svgContainer,
      onUpdate: (event) => this._handleInteraction(event)
    })
    this._updateInteractionState()

    window.addEventListener('resize', () => this._resizeStage())

    // Initialize selection with first object if available
    const initialObjects = this.collectionManager.getAll()
    if (initialObjects.length > 0) {
      this._selectObject(initialObjects[0])
    } else {
      this.collectionPanel.setSelected(null)
      this._refreshPropertiesPanel(null)
    }

    // Initial render of overlay image if present
    this._renderOverlayImage()
    
    // Initialize zoom UI
    this._updateZoomUI()
  }

  _refreshCollectionPanel() {
    if (!this.collectionPanel || !this.collectionPanelRoot) return
    const parent = this.collectionPanelRoot.parentElement
    if (!parent) return
    const newPanel = this.collectionPanel.render()
    parent.replaceChild(newPanel, this.collectionPanelRoot)
    this.collectionPanelRoot = newPanel
    this.collectionPanel.setSelected(this.selectedObject?.id || null)
  }

  _refreshPropertiesPanel(object) {
    if (!this.propertiesPanel || !this.propertiesPanelRoot) return
    const parent = this.propertiesPanelRoot.parentElement
    if (!parent) return
    const newPanel = this.propertiesPanel.render(object)
    parent.replaceChild(newPanel, this.propertiesPanelRoot)
    this.propertiesPanelRoot = newPanel
  }

  _resizeStage() {
    if (!this.svgRenderer || !this.poseVisualizer) return

    const svgContainer = this.svgRenderer.container
    const { clientWidth, clientHeight } = svgContainer

    const scale = DEFAULT_CONFIG.stage.height / DEFAULT_CONFIG.stage.width
    const width = round(clientWidth, 3)
    const height = round(clientWidth * scale, 3)

    const w = this.stageRoot.clientWidth - 20
    this.stageRoot.style.height = `${round(w * scale, 3) + 20}px`
    this.stageRoot.style.minHeight = `${round(w * scale, 3) + 20}px`

    this.svgRenderer.resize(width, height)
    this.canvasRenderer.resize(width, height)
    this.poseVisualizer.resize(width, height)

    // Resize rulers
    if (this.horizontalRuler) {
      this.horizontalRuler.resize(width, 20)
    }
    if (this.verticalRuler) {
      this.verticalRuler.resize(20, height)
    }

    this.renderScene()
  }

  _generateObjectLabel() {
    const prefix = (this.overlayImage?.labelPrefix || '').trim()
    if (!prefix) {
      return 'New object'
    }

    const key = prefix.toLowerCase()
    const next = (this.labelPrefixCounters.get(key) || 0) + 1
    this.labelPrefixCounters.set(key, next)

    const suffix = String(next).padStart(4, '0')
    return `${prefix}_${suffix}`
  }

  _createPlaceholderObject() {
    const label = this._generateObjectLabel()
    const name = label === 'New object' ? `Object ${Date.now()}` : label
    const obj = {
      type: 'object',
      name,
      label,
      nodes: [
        {
          x: 50,
          y: 50,
          start: { x: 10, y: 40 },
          end: { x: 40, y: 10 }
        },
        {
          x: 300,
          y: 50,
          start: { x: 340, y: 40 },
          end: { x: 340, y: 80 }
        },
        {
          x: 50,
          y: 300,
          start: { x: 90, y: 340 },
          end: { x: 50, y: 340 }
        }
      ],
      svg_element: 'path',
      stroke: '#3b82f6',
      strokeWidth: 2,
      fill: '#ffffff',
      opacity: 0.5,
      offset: { x: 0, y: 0, z: 0 },
      rotate: { x: 0, y: 0, z: 0 },
      closed: true
    }
    const created = this.collectionManager.add(obj)
    this.interactionManager.reset() // important for mobile touch only
    this.activeHandle = null
    this._selectObject(created)
  }

  _createPlaceholderGroup() {
    const group = {
      type: 'group',
      svg_element: 'g',
      name: `Group ${Date.now()}`,
      label: 'New group',
      children: [],
      offset: { x: 0, y: 0, z: 0 },
      rotate: { x: 0, y: 0, z: 0 }
    }
    const created = this.collectionManager.add(group)
    this._selectObject(created)
  }

  _assignToGroup(objectId, groupId = null) {
    if (!objectId) return

    // If groupId is provided (from drag and drop), assign directly
    if (groupId) {
      const success = this.collectionManager.moveToGroup(objectId, groupId)
      if (success) {
        this._refreshCollectionPanel()
        this.renderScene()
      }
      return
    }

    // Otherwise, show a modal to select a group
    const groups = this.collectionManager.getAllGroups()
    if (groups.length === 0) {
      alert('No groups available. Please create a group first.')
      return
    }

    // Create a simple modal/dropdown
    const modal = document.createElement('div')
    modal.classList.add('modal-overlay')
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `

    const dialog = document.createElement('div')
    dialog.classList.add('modal-dialog')
    dialog.style.cssText = `
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      min-width: 300px;
      max-width: 90vw;
    `

    const title = document.createElement('h3')
    title.textContent = 'Select Group'
    title.style.cssText = 'margin: 0 0 1rem 0; font-size: 1rem;'

    const select = document.createElement('select')
    select.style.cssText = `
      width: 100%;
      padding: 0.5rem;
      background: rgba(10, 16, 30, 0.7);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      margin-bottom: 1rem;
    `

    const noneOption = document.createElement('option')
    noneOption.value = ''
    noneOption.textContent = '-- Remove from group (top level) --'
    select.appendChild(noneOption)

    groups.forEach((group) => {
      const option = document.createElement('option')
      option.value = group.id
      option.textContent = group.name || group.id
      select.appendChild(option)
    })

    const buttonContainer = document.createElement('div')
    buttonContainer.style.cssText =
      'display: flex; gap: 0.5rem; justify-content: flex-end;'

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = 'Cancel'
    cancelBtn.style.cssText = `
      padding: 0.5rem 1rem;
      background: transparent;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      cursor: pointer;
    `
    cancelBtn.onclick = () => modal.remove()

    const assignBtn = document.createElement('button')
    assignBtn.textContent = 'Assign'
    assignBtn.style.cssText = `
      padding: 0.5rem 1rem;
      background: var(--accent);
      border: none;
      border-radius: var(--radius-md);
      color: white;
      cursor: pointer;
    `
    assignBtn.onclick = () => {
      const selectedGroupId = select.value
      if (selectedGroupId) {
        this.collectionManager.moveToGroup(objectId, selectedGroupId)
      } else {
        this.collectionManager.removeFromGroup(objectId)
      }
      this._refreshCollectionPanel()
      this.renderScene()
      modal.remove()
    }

    buttonContainer.appendChild(cancelBtn)
    buttonContainer.appendChild(assignBtn)

    dialog.appendChild(title)
    dialog.appendChild(select)
    dialog.appendChild(buttonContainer)
    modal.appendChild(dialog)

    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove()
      }
    }

    document.body.appendChild(modal)
    select.focus()
  }

  _selectObject(obj) {
    this.selectedObject = obj || null
    this.collectionPanel?.setSelected(this.selectedObject?.id || null)
    this._refreshPropertiesPanel(this.selectedObject)
    this.renderScene()
  }

  _updateSelectedObject(updates) {
    if (!this.selectedObject) return
    const updated = this.collectionManager.update(
      this.selectedObject.id,
      updates
    )
    if (updated) {
      this._selectObject(updated)
      // Refresh collection panel to show updated name/label
      this._refreshCollectionPanel()
    }
  }

  _addNodeToSelectedObject() {
    if (!this.selectedObject) return

    const result = this.collectionManager.addNode(this.selectedObject.id)
    if (!result) {
      window.alert?.('Unable to add node to the selected item.')
      return
    }

    const refreshed = this.collectionManager.findInGroups(
      this.selectedObject.id
    )
    if (refreshed) {
      this._selectObject(refreshed)
    } else {
      this.renderScene()
    }
  }

  _duplicateObject(id) {
    const cloned = this.collectionManager.clone(id)
    if (cloned) {
      this._selectObject(cloned)
    }
  }

  _deleteObject(id) {
    const wasDeleted = this.collectionManager.remove(id)
    if (!wasDeleted) return

    if (this.selectedObject && this.selectedObject.id === id) {
      const remaining = this.collectionManager.getAll()
      this._selectObject(remaining[0] || null)
    } else {
      this.collectionPanel?.setSelected(this.selectedObject?.id || null)
    }
  }

  _resetCollection() {
    this.collectionManager.clear()
    this._selectObject(null)
  }

  _exportCollection() {
    const data = JSON.stringify(this.collectionManager.getAll(), null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `preview2-collection-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  _applyFirebaseConfig(config) {
    const databaseUrl =
      typeof config?.databaseUrl === 'string' ? config.databaseUrl.trim() : ''

    if (!databaseUrl) {
      window.alert?.('Firebase config is missing a valid "databaseUrl".')
      return
    }

    this.config.firebase = {
      ...this.config.firebase,
      databaseUrl
    }

    this.firebaseClient = new FirebaseClient({
      databaseUrl,
      authToken: this.config.firebase.authToken
    })

    const canUpload = this.firebaseClient.isConfigured()
    this.projectsPanel?.setUploadOptions({
      canUpload,
      isUploading: this.isUploadingProject
    })

    window.alert?.('Firebase configuration updated.')
  }

  _updateControlScale(value) {
    const scale = Math.min(6, Math.max(0.5, Number(value) || 1))
    this.controlScale = scale

    const scaledControls = {}
    const baseControls = this.baseControls || DEFAULT_CONFIG.controls || {}
    Object.entries(baseControls).forEach(([key, val]) => {
      if (typeof val === 'number') {
        scaledControls[key] = Number((val * scale).toFixed(4))
      } else {
        scaledControls[key] = val
      }
    })

    this.config.controls = scaledControls
    this.svgRenderer?.setControlsConfig(this.config.controls)
    this.settingsPanel?.setControlScale(this.controlScale)
    this.renderScene()
  }

  _handleZoomIn() {
    if (this.svgRenderer) {
      this.svgRenderer.zoomIn(1.5)
      this._updateZoomUI()
      this._updateOverlayImageScale()
      this.renderScene()
    }
  }

  _handleZoomOut() {
    if (this.svgRenderer) {
      this.svgRenderer.zoomOut()
      this._updateZoomUI()
      this._updateOverlayImageScale()
      this.renderScene()
    }
  }

  _updateZoomUI() {
    if (this.svgRenderer && this.settingsPanel) {
      const zoom = this.svgRenderer.getZoom()
      this.settingsPanel.setZoom(zoom)
    }
  }

  _updateOverlayImageScale() {
    if (!this.svgRenderer || !this.imageOverlay) return
    // Re-render overlay image with updated zoom scale
    this._renderOverlayImage()
  }

  async _uploadCurrentProject() {
    if (!this.firebaseClient || !this.firebaseClient.isConfigured()) {
      window.alert(
        'Firebase is not configured. Please update config to enable uploads.'
      )
      return
    }

    const currentProject = this.projectManager.getCurrent()
    if (!currentProject) {
      window.alert('No project selected to upload.')
      return
    }

    // Ensure latest collection state is saved to the project before uploading
    this.collectionManager.save()

    this.isUploadingProject = true
    this.projectsPanel?.setUploadOptions({
      isUploading: true,
      canUpload: this.firebaseClient.isConfigured()
    })

    try {
      const refreshedProject = this.projectManager.getCurrent()
      await this.firebaseClient.uploadProject(refreshedProject)
      window.alert('Project uploaded to Firebase successfully.')
    } catch (error) {
      console.error('Firebase upload failed', error)
      window.alert(`Failed to upload project: ${error.message || error}`)
    } finally {
      this.isUploadingProject = false
      this.projectsPanel?.setUploadOptions({
        isUploading: false,
        canUpload: this.firebaseClient.isConfigured()
      })
    }
  }

  _createOverlayImagePanel() {
    const container = document.createElement('div')
    container.classList.add('overlay-image-panel')

    // File input (hidden)
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.style.display = 'none'
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0]
      if (file) {
        this._loadOverlayImage(file)
      }
    })

    // Upload button
    const uploadBtn = createButton({
      label: 'Load Reference Image',
      variant: 'primary',
      onClick: () => fileInput.click()
    })

    const prefixSection = document.createElement('div')
    prefixSection.classList.add('properties-field')
    prefixSection.style.marginTop = '1rem'

    const prefixLabel = document.createElement('label')
    prefixLabel.textContent = 'Label Prefix'
    prefixLabel.style.marginBottom = '0.5rem'
    prefixLabel.style.display = 'block'

    const prefixInput = document.createElement('input')
    prefixInput.type = 'text'
    prefixInput.placeholder = 'Auto from file name'
    prefixInput.value = this.overlayImage.labelPrefix || ''
    prefixInput.disabled = !this.overlayImage.url
    prefixInput.addEventListener('input', (event) => {
      const sanitized = this._setOverlayLabelPrefix(event.target.value, {
        resetCounter: false
      })
      if (sanitized !== event.target.value) {
        event.target.value = sanitized
      }
    })

    const fileInfo = document.createElement('div')
    fileInfo.style.fontSize = '0.7rem'
    fileInfo.style.color = 'var(--text-secondary)'
    fileInfo.style.marginTop = '0.25rem'
    fileInfo.textContent = this.overlayImage.fileName
      ? `Loaded file: ${this.overlayImage.fileName}`
      : 'No reference image loaded'

    prefixSection.appendChild(prefixLabel)
    prefixSection.appendChild(prefixInput)
    prefixSection.appendChild(fileInfo)

    const positionSection = document.createElement('div')
    positionSection.classList.add('properties-field')
    positionSection.style.marginTop = '1rem'

    const positionLabel = document.createElement('label')
    positionLabel.textContent = 'Position Offset (px)'
    positionLabel.style.marginBottom = '0.5rem'
    positionLabel.style.display = 'block'

    const positionContainer = document.createElement('div')
    positionContainer.style.display = 'flex'
    positionContainer.style.gap = '0.5rem'

    const position = this.overlayImage.position || { x: 0, y: 0 }
    const createPositionField = (axis, labelText) => {
      const wrapper = document.createElement('div')
      wrapper.style.display = 'flex'
      wrapper.style.flexDirection = 'column'
      wrapper.style.gap = '0.25rem'

      const label = document.createElement('span')
      label.textContent = labelText
      label.style.fontSize = '0.7rem'
      label.style.color = 'var(--text-secondary)'

      const input = document.createElement('input')
      input.type = 'number'
      input.step = '1'
      input.value = String(position[axis] || 0)
      input.disabled = !this.overlayImage.url
      input.style.width = '90px'
      input.addEventListener('change', (event) => {
        const raw = parseFloat(event.target.value)
        if (Number.isFinite(raw)) {
          this._updateOverlayPosition(axis, raw)
        } else if (event.target.value === '') {
          return
        } else {
          this._updateOverlayPosition(axis, 0)
        }
        event.target.value = String(this.overlayImage.position?.[axis] || 0)
      })

      wrapper.appendChild(label)
      wrapper.appendChild(input)
      return wrapper
    }

    positionContainer.appendChild(createPositionField('x', 'Horizontal (X)'))
    positionContainer.appendChild(createPositionField('y', 'Vertical (Y)'))

    positionSection.appendChild(positionLabel)
    positionSection.appendChild(positionContainer)

    // Opacity control
    const opacitySection = document.createElement('div')
    opacitySection.classList.add('properties-field')
    opacitySection.style.marginTop = '1rem'

    const opacityLabel = document.createElement('label')
    opacityLabel.textContent = 'Opacity'
    opacityLabel.style.marginBottom = '0.5rem'
    opacityLabel.style.display = 'block'

    const opacityContainer = document.createElement('div')
    opacityContainer.style.display = 'flex'
    opacityContainer.style.gap = '0.5rem'
    opacityContainer.style.alignItems = 'center'

    const opacitySlider = document.createElement('input')
    opacitySlider.type = 'range'
    opacitySlider.min = '0'
    opacitySlider.max = '1'
    opacitySlider.step = '0.05'
    opacitySlider.value = this.overlayImage.opacity
    opacitySlider.style.flex = '1'
    opacitySlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value)
      this._updateOverlayImage({ opacity: value })
    })

    const opacityValue = document.createElement('input')
    opacityValue.type = 'number'
    opacityValue.min = '0'
    opacityValue.max = '1'
    opacityValue.step = '0.05'
    opacityValue.value = this.overlayImage.opacity
    opacityValue.style.width = '60px'
    opacityValue.addEventListener('input', (e) => {
      const value = Math.min(1, Math.max(0, parseFloat(e.target.value) || 0))
      this._updateOverlayImage({ opacity: value })
      opacitySlider.value = value
    })

    opacitySlider.addEventListener('input', (e) => {
      opacityValue.value = e.target.value
    })

    opacityContainer.appendChild(opacitySlider)
    opacityContainer.appendChild(opacityValue)
    opacitySection.appendChild(opacityLabel)
    opacitySection.appendChild(opacityContainer)

    // Toggle visibility
    const toggleBtn = createButton({
      label: this.overlayImage.visible ? 'Hide Image' : 'Show Image',
      variant: 'ghost',
      onClick: () => {
        const newVisible = !this.overlayImage.visible
        this._updateOverlayImage({ visible: newVisible })
        toggleBtn.textContent = newVisible ? 'Hide Image' : 'Show Image'
      },
      disabled: !this.overlayImage.url
    })

    // Remove button
    const removeBtn = createButton({
      label: 'Remove Image',
      variant: 'ghost',
      onClick: () => this._removeOverlayImage(),
      disabled: !this.overlayImage.url
    })

    container.appendChild(fileInput)
    container.appendChild(uploadBtn)
    container.appendChild(prefixSection)
    container.appendChild(positionSection)
    if (this.overlayImage.url) {
      container.appendChild(opacitySection)
    }

    const buttonContainer = document.createElement('div')
    buttonContainer.style.display = 'flex'
    buttonContainer.style.gap = '0.5rem'
    buttonContainer.style.marginTop = '0.75rem'
    buttonContainer.style.flexDirection = 'column'
    buttonContainer.appendChild(toggleBtn)
    buttonContainer.appendChild(removeBtn)
    container.appendChild(buttonContainer)

    this.overlayImagePanel = container

    return createPanel({
      title: 'Reference Image',
      content: container
    })
  }

  _loadOverlayImage(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target.result
      const fileName = file.name || 'reference'
      const labelPrefix = this._setOverlayLabelPrefix(fileName, {
        resetCounter: true
      })
      this._updateOverlayImage({
        url: url,
        visible: true,
        position: { x: 0, y: 0 },
        fileName,
        labelPrefix
      })
      this._refreshOverlayImagePanel()
    }
    reader.onerror = () => {
      alert('Failed to load image')
    }
    reader.readAsDataURL(file)
  }

  _sanitizeLabelPrefix(value) {
    if (!value) return ''
    const withoutExtension = value.replace(/\.[^/.]+$/, '')
    const sanitized = withoutExtension
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
    return sanitized
  }

  _setOverlayLabelPrefix(prefix, { resetCounter = false } = {}) {
    const sanitized = this._sanitizeLabelPrefix(prefix)
    const key = sanitized.toLowerCase()
    const previousKey = this.currentLabelPrefixKey
    this.overlayImage.labelPrefix = sanitized

    if (sanitized) {
      if (
        resetCounter ||
        key !== previousKey ||
        !this.labelPrefixCounters.has(key)
      ) {
        this.labelPrefixCounters.set(key, 0)
      }
      this.currentLabelPrefixKey = key
    } else {
      this.currentLabelPrefixKey = ''
    }

    return sanitized
  }

  _updateOverlayImage(updates) {
    Object.assign(this.overlayImage, updates)
    this._renderOverlayImage()
  }

  _updateOverlayPosition(axis, value) {
    if (!['x', 'y'].includes(axis)) return
    const numeric = Number.isFinite(value) ? value : 0
    const current = this.overlayImage.position || { x: 0, y: 0 }
    const next = {
      ...current,
      [axis]: numeric
    }
    this._updateOverlayImage({ position: next })
  }

  _removeOverlayImage() {
    const previousPrefix = this.overlayImage.labelPrefix
    if (previousPrefix) {
      this.labelPrefixCounters.delete(previousPrefix.toLowerCase())
    }
    this.currentLabelPrefixKey = ''
    this.overlayImage = {
      url: null,
      opacity: 0.5,
      visible: false,
      position: { x: 0, y: 0 },
      scale: 1,
      fileName: null,
      labelPrefix: ''
    }
    this._renderOverlayImage()
    this._refreshOverlayImagePanel()
  }

  _renderOverlayImage() {
    if (!this.imageOverlay) return

    if (this.overlayImage.url && this.overlayImage.visible) {
      this.imageOverlay.src = this.overlayImage.url
      this.imageOverlay.style.opacity = this.overlayImage.opacity
      this.imageOverlay.style.display = 'block'
      const position = this.overlayImage.position || { x: 0, y: 0 }
      // Scale should account for zoom level
      const baseScale = Number.isFinite(this.overlayImage.scale) ? this.overlayImage.scale : 1
      const zoom = this.svgRenderer?.getZoom() || 1.0
      const scale = baseScale / zoom // Compensate for zoom
      this.imageOverlay.style.transformOrigin = 'top left'
      this.imageOverlay.style.transform = `translate(${position.x}px, ${position.y}px) scale(${scale})`
    } else {
      this.imageOverlay.style.display = 'none'
      this.imageOverlay.style.transform = ''
    }
  }

  _refreshOverlayImagePanel() {
    if (!this.overlayImagePanel) return
    const panelElement = this.overlayImagePanel.closest('.ui-panel')
    if (!panelElement) return
    const parent = panelElement.parentElement
    if (!parent) return

    const newPanel = this._createOverlayImagePanel()
    parent.replaceChild(newPanel, panelElement)
    // Find the panel container in the new structure
    this.overlayImagePanel = newPanel.querySelector('.overlay-image-panel')
  }

  _updateInteractionState() {
    if (!this.interactionManager) return
    this.interactionManager.setCamera(this.camera.getState())
    // Rotation would be set here if we add rotation gestures
  }

  _handleInteraction(event) {
    if (event.type === 'select') {
      // Clicked on an object - select it (might be nested in a group)
      const obj = this.collectionManager.findInGroups(event.objectId)
      if (obj) {
        this._selectObject(obj)
      }
      return
    }

    if (event.type === 'pointer-down-on-handle') {
      // Check if object is locked
      const obj = this.collectionManager.findInGroups(event.objectId)
      if (obj && obj.locked) {
        // Object is locked, start panning instead
        this.interactionManager._startPanning(event.event, event.clientX, event.clientY)
      } else {
        // Object not locked, allow handle drag
        this.interactionManager.isDragging = true
        this.interactionManager.dragHandle = {
          type: event.handleType,
          index: event.index,
          objectId: event.objectId
        }
        // Notify about active handle for visual feedback
        this.activeHandle = this.interactionManager.dragHandle
        this.renderScene()
      }
      return
    }

    if (event.type === 'pointer-down-on-object') {
      // Check if object is locked
      const obj = this.collectionManager.findInGroups(event.objectId)
      if (obj && obj.locked) {
        // Object is locked, start panning instead
        this.interactionManager._startPanning(event.event, event.clientX, event.clientY)
        // Still select the object
        this._selectObject(obj)
      } else {
        // Object not locked, handle normally
        const handleType = event.handleType
        const target = event.target
        
        // If it's a draggable path (has data-type='origin'), prepare for drag
        if (handleType === 'origin' && target.hasAttribute('data-object-id')) {
          this.interactionManager.isDragging = true
          this.interactionManager.dragHandle = {
            type: 'origin',
            index: parseInt(target.getAttribute('data-index') || '0', 10),
            objectId: event.objectId
          }
          // Notify about active handle for visual feedback
          this.activeHandle = this.interactionManager.dragHandle
          this.renderScene()
        }

        // Always select the object when interacting with it
        this._selectObject(obj)
      }
      return
    }

    if (event.type === 'pan') {
      // Handle pan (viewBox change)
      if (this.svgRenderer && event.viewBox) {
        const svg = this.svgRenderer.svg
        if (svg) {
          svg.setAttribute('viewBox', `${event.viewBox.x} ${event.viewBox.y} ${event.viewBox.width} ${event.viewBox.height}`)
          this.renderScene()
        }
      }
      return
    }

    if (event.type === 'active-handle') {
      // Update active handle state for visual feedback
      this.activeHandle = event.handle
      this.renderScene()
      return
    }

    if (event.type === 'get-initial-zoom') {
      // Provide initial zoom for pinch-to-zoom
      if (this.svgRenderer && this.interactionManager) {
        this.interactionManager.initialZoom = this.svgRenderer.getZoom()
      }
      return
    }

    if (event.type === 'zoom') {
      // Handle zoom (from pinch-to-zoom)
      if (this.svgRenderer && event.zoom && event.centerX !== undefined && event.centerY !== undefined) {
        this.svgRenderer.zoomToPoint(event.zoom, event.centerX, event.centerY)
        this._updateZoomUI()
        this._updateOverlayImageScale()
        this.renderScene()
      }
      return
    }

    if (event.type === 'drag-end') {
      this.collectionManager.save()
      return
    }

    if (event.type !== 'drag' || !event.handle || !event.delta) {
      return
    }

    const { handle, delta } = event
    // Always get fresh object state to avoid stale references (might be nested in a group)
    const obj = this.collectionManager.findInGroups(handle.objectId)
    if (!obj) return

    // Handle groups - they can only be moved by offset
    if (obj.type === 'group' || obj.svg_element === 'g') {
      if (handle.type === 'origin') {
        const offset = obj.offset || { x: 0, y: 0, z: 0 }
        const updated = this.collectionManager.update(handle.objectId, {
          offset: {
            x: offset.x + delta.x,
            y: offset.y + delta.y,
            z: offset.z + (delta.z || 0)
          }
        })

        // Update selected object reference immediately so controls re-render
        if (
          this.selectedObject &&
          this.selectedObject.id === handle.objectId &&
          updated
        ) {
          this.selectedObject = updated
        }
      }

      // Refresh properties panel and re-render
      if (this.selectedObject && this.selectedObject.id === handle.objectId) {
        this._refreshPropertiesPanel(this.selectedObject)
      }
      this.renderScene()
      return
    }

    // Regular objects need nodes
    if (!Array.isArray(obj.nodes)) return

    const nodeIndex = handle.index

    if (handle.type === 'origin') {
      // Move entire object by offset
      const offset = obj.offset || { x: 0, y: 0, z: 0 }
      this.collectionManager.update(handle.objectId, {
        offset: {
          x: offset.x + delta.x,
          y: offset.y + delta.y,
          z: offset.z + (delta.z || 0)
        }
      })
    } else if (handle.type === 'anchor') {
      // Move anchor point and its control points
      if (nodeIndex >= 0 && nodeIndex < obj.nodes.length) {
        const node = obj.nodes[nodeIndex]
        const updatedNodes = [...obj.nodes]
        const baseX = node.x || 0
        const baseY = node.y || 0
        const baseZ = node.z || 0

        updatedNodes[nodeIndex] = {
          ...node,
          x: baseX + delta.x,
          y: baseY + delta.y,
          z: baseZ + (delta.z || 0),
          start: {
            ...(node.start || { x: baseX, y: baseY }),
            x: (node.start?.x ?? baseX) + delta.x,
            y: (node.start?.y ?? baseY) + delta.y
          },
          end: {
            ...(node.end || { x: baseX, y: baseY }),
            x: (node.end?.x ?? baseX) + delta.x,
            y: (node.end?.y ?? baseY) + delta.y
          }
        }
        this.collectionManager.update(handle.objectId, { nodes: updatedNodes })
      }
    } else if (handle.type === 'start' || handle.type === 'end') {
      // Move control point - only update the specific control point being dragged
      if (nodeIndex >= 0 && nodeIndex < obj.nodes.length) {
        const node = obj.nodes[nodeIndex]
        const updatedNodes = [...obj.nodes]
        updatedNodes[nodeIndex] = {
          ...node,
          [handle.type]: {
            x: node[handle.type]?.x + delta.x,
            y: node[handle.type]?.y + delta.y
          }
        }
        this.collectionManager.update(handle.objectId, { nodes: updatedNodes })
      }
    }

    // Update selected object reference if it was modified (might be nested in a group)
    if (this.selectedObject && this.selectedObject.id === handle.objectId) {
      this.selectedObject = this.collectionManager.findInGroups(handle.objectId)
      if (this.selectedObject) {
        this._refreshPropertiesPanel(this.selectedObject)
      }
    }

    this.renderScene()
  }

  renderScene() {
    if (!this.svgRenderer) return

    this._updateInteractionState()

    const scene = {
      objects: this.collectionManager.getAll(),
      camera: this.camera.getState(),
      selectedId: this.selectedObject?.id || null,
      activeHandle: this.activeHandle
    }

    this.svgRenderer.requestRender(scene)

    // Update rulers
    if (this.horizontalRuler && this.verticalRuler) {
      const viewBox = {
        x: 0,
        y: 0,
        width: this.config.stage.width,
        height: this.config.stage.height
      }
      this.horizontalRuler.update(this.camera.getState(), viewBox)
      this.verticalRuler.update(this.camera.getState(), viewBox)
    }
  }
}
