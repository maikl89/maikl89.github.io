/**
 * CollectionPanel - Displays collection of objects
 */

import { createPanel } from '../components/Panel.js'
import { createButton } from '../components/Button.js'

export class CollectionPanel {
  constructor({
    manager,
    onSelect = () => {},
    onCreate = () => {},
    onCreateGroup = () => {},
    onAssignToGroup = () => {},
    onDuplicate = () => {},
    onDelete = () => {},
    onReset = () => {},
    onExport = () => {}
  } = {}) {
    this.manager = manager
    this.onSelect = onSelect
    this.onCreate = onCreate
    this.onCreateGroup = onCreateGroup
    this.onAssignToGroup = onAssignToGroup
    this.onDuplicate = onDuplicate
    this.onDelete = onDelete
    this.onReset = onReset
    this.onExport = onExport
    this.selectedId = null
    this.root = null
    this.list = null
    this.draggedItemId = null
    this.actions = {
      add: null,
      addGroup: null,
      assignToGroup: null,
      duplicate: null,
      delete: null,
      reset: null,
      export: null
    }
  }

  render() {
    this.list = document.createElement('ul')
    this.list.classList.add('collection-list')

    const objects = this.manager ? this.manager.getAll() : []
    objects.forEach(obj => {
      const item = this._createListItem(obj, 0)
      this.list.appendChild(item)
    })

    this.actions.add = createButton({
      label: 'New Object',
      variant: 'primary',
      onClick: () => this.onCreate()
    })

    this.actions.addGroup = createButton({
      label: 'New Group',
      variant: 'ghost',
      onClick: () => this.onCreateGroup()
    })

    this.actions.assignToGroup = createButton({
      label: 'Assign to Group',
      variant: 'ghost',
      onClick: () => {
        if (this.selectedId) {
          this.onAssignToGroup(this.selectedId)
        }
      },
      disabled: !this.selectedId
    })

    this.actions.duplicate = createButton({
      label: 'Duplicate',
      variant: 'ghost',
      onClick: () => {
        if (this.selectedId) {
          this.onDuplicate(this.selectedId)
        }
      },
      disabled: !this.selectedId
    })

    this.actions.delete = createButton({
      label: 'Delete',
      variant: 'ghost',
      onClick: () => {
        if (this.selectedId) {
          this.onDelete(this.selectedId)
        }
      },
      disabled: !this.selectedId
    })

    this.actions.reset = createButton({
      label: 'Reset',
      variant: 'ghost',
      onClick: () => this.onReset()
    })

    this.actions.export = createButton({
      label: 'Export',
      variant: 'ghost',
      onClick: () => this.onExport()
    })

    this.root = createPanel({
      title: 'Collection',
      actions: [
        this.actions.add,
        this.actions.addGroup,
        this.actions.assignToGroup,
        this.actions.duplicate,
        this.actions.delete,
        this.actions.reset,
        this.actions.export
      ],
      content: this.list
    })

    // Setup drag and drop
    this._setupDragAndDrop()

    return this.root
  }

  _createListItem(obj, depth = 0) {
    const item = document.createElement('li')
    item.classList.add('collection-list__item')
    item.dataset.id = obj.id
    
    // Add depth class for indentation
    if (depth > 0) {
      item.classList.add(`collection-list__item--depth-${depth}`)
    }

    // Check if it's a group
    const isGroup = obj.type === 'group' || obj.svg_element === 'g'
    if (isGroup) {
      item.classList.add('collection-list__item--group')
    } else {
      item.classList.add('collection-list__item--object')
    }

    // Create container for content with indentation
    const content = document.createElement('div')
    content.classList.add('collection-list__item-content')
    content.style.paddingLeft = `${depth * 16}px`

    // Add icon/badge for type
    const icon = document.createElement('span')
    icon.classList.add('collection-list__item-icon')
    if (isGroup) {
      icon.textContent = '📁'
      icon.title = 'Group'
    } else {
      icon.textContent = '◯'
      icon.title = 'Object'
    }

    const title = document.createElement('div')
    title.classList.add('collection-list__item-title')
    title.textContent = obj.name

    const meta = document.createElement('div')
    meta.classList.add('collection-list__item-meta')
    
    if (isGroup) {
      const children = obj.children || []
      const childCount = children.length
      meta.textContent = `${childCount} ${childCount === 1 ? 'item' : 'items'}`
    } else {
      const label = obj.label ? `• ${obj.label}` : ''
      const nodes = Array.isArray(obj.nodes) ? `${obj.nodes.length} nodes` : '0 nodes'
      meta.textContent = [nodes, label].filter(Boolean).join(' ')
    }

    content.appendChild(icon)
    content.appendChild(title)
    item.appendChild(content)
    item.appendChild(meta)

    if (obj.id === this.selectedId) {
      item.classList.add('is-selected')
    }

    // Make items draggable (except when clicking on children)
    item.setAttribute('draggable', 'true')
    item.dataset.objectId = obj.id
    item.dataset.isGroup = isGroup ? 'true' : 'false'

    item.addEventListener('dragstart', (e) => {
      this.draggedItemId = obj.id
      item.classList.add('is-dragging')
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', obj.id)
    })

    item.addEventListener('dragend', (e) => {
      item.classList.remove('is-dragging')
      // Remove drop target highlights
      this.list.querySelectorAll('.is-drop-target').forEach(el => {
        el.classList.remove('is-drop-target')
      })
      this.draggedItemId = null
    })

    // Make groups droppable
    if (isGroup) {
      item.addEventListener('dragover', (e) => {
        if (this.draggedItemId && this.draggedItemId !== obj.id) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          item.classList.add('is-drop-target')
        }
      })

      item.addEventListener('dragleave', (e) => {
        item.classList.remove('is-drop-target')
      })

      item.addEventListener('drop', (e) => {
        e.preventDefault()
        item.classList.remove('is-drop-target')
        
        if (this.draggedItemId && this.draggedItemId !== obj.id) {
          this.onAssignToGroup(this.draggedItemId, obj.id)
        }
      })
    }

    item.addEventListener('click', (e) => {
      // Stop propagation to prevent parent selection when clicking children
      e.stopPropagation()
      this.setSelected(obj.id)
      this.onSelect(obj)
    })

    // If it's a group, add children with indentation
    if (isGroup && Array.isArray(obj.children) && obj.children.length > 0) {
      const childrenContainer = document.createElement('ul')
      childrenContainer.classList.add('collection-list__children')
      
      // Prevent clicks on children container from selecting parent
      childrenContainer.addEventListener('click', (e) => {
        e.stopPropagation()
      })
      
      obj.children.forEach(child => {
        const childItem = this._createListItem(child, depth + 1)
        childItem.classList.add('collection-list__item--child')
        childrenContainer.appendChild(childItem)
      })
      
      item.appendChild(childrenContainer)
    }

    return item
  }

  setSelected(id) {
    this.selectedId = id || null

    if (this.list) {
      // Find all items including nested children
      const items = this.list.querySelectorAll('.collection-list__item')
      items.forEach(item => {
        if (item.dataset.id === this.selectedId) {
          item.classList.add('is-selected')
        } else {
          item.classList.remove('is-selected')
        }
      })
    }

    if (this.actions.duplicate) {
      this.actions.duplicate.disabled = !this.selectedId
    }

    if (this.actions.delete) {
      this.actions.delete.disabled = !this.selectedId
    }

    if (this.actions.assignToGroup) {
      this.actions.assignToGroup.disabled = !this.selectedId
    }
  }

  _setupDragAndDrop() {
    // Global drag and drop handlers are set up per item in _createListItem
    // This method can be used for any global drag/drop setup if needed
  }
}
