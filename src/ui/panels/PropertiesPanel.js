/**
 * PropertiesPanel - Shows selected object properties
 */

import { createPanel } from '../components/Panel.js'
import { createButton } from '../components/Button.js'
import { degToRad, radToDeg } from '../../utils/math.js'

export class PropertiesPanel {
  constructor({ onChange = () => {}, onAddNode = () => {} } = {}) {
    this.onChange = onChange
    this.onAddNode = onAddNode
    this.root = null
    this.form = null
  }

  render(object = null) {
    const container = document.createElement('div')
    container.classList.add('properties-panel')

    if (!object) {
      container.innerHTML = '<p>Select an object to see its properties.</p>'
    } else {
      this.form = document.createElement('form')
      this.form.classList.add('properties-form')
      container.appendChild(this.form)

      const generalSection = this._createSection('General', [
        this._createInput('Name', object.name || '', (value) => {
          this.onChange({ name: value })
        }),
        this._createInput('Label', object.label || '', (value) => {
          this.onChange({ label: value })
        })
      ])

      const appearanceSection = this._createSection('Appearance', [
        this._createColorInput('Fill', object.fill ?? '#ffffff', (value) => {
          this.onChange({ fill: value })
        }),
        this._createColorInput('Stroke', object.stroke ?? '#000000', (value) => {
          this.onChange({ stroke: value })
        }),
        this._createNumberInput('Stroke Width', object.strokeWidth ?? 1, (value) => {
          this.onChange({ strokeWidth: Number(value) })
        }, { step: '0.1', min: '0' }),
        this._createNumberInput('Opacity', object.opacity ?? 1, (value) => {
          const numeric = Math.min(1, Math.max(0, Number(value)))
          this.onChange({ opacity: numeric })
        }, { step: '0.05', min: '0', max: '1' })
      ])

      const offset = {
        x: object.offset?.x ?? 0,
        y: object.offset?.y ?? 0,
        z: object.offset?.z ?? 0
      }
      const offsetSection = this._createSection('Offset', [
        this._createNumberInput('Offset X', offset.x, (value) => {
          this.onChange({ offset: { ...offset, x: Number(value) } })
          offset.x = Number(value)
        }),
        this._createNumberInput('Offset Y', offset.y, (value) => {
          this.onChange({ offset: { ...offset, y: Number(value) } })
          offset.y = Number(value)
        }),
        this._createNumberInput('Offset Z', offset.z, (value) => {
          this.onChange({ offset: { ...offset, z: Number(value) } })
          offset.z = Number(value)
        })
      ])

      const rotation = {
        x: radToDeg(object.rotate?.x ?? 0),
        y: radToDeg(object.rotate?.y ?? 0),
        z: radToDeg(object.rotate?.z ?? 0)
      }
      const rotationSection = this._createSection('Rotation (deg)', [
        this._createNumberInput('Rotate X', rotation.x, (value) => {
          rotation.x = Number(value)
          this.onChange({ rotate: { x: degToRad(rotation.x), y: degToRad(rotation.y), z: degToRad(rotation.z) } })
        }, { step: '1' }),
        this._createNumberInput('Rotate Y', rotation.y, (value) => {
          rotation.y = Number(value)
          this.onChange({ rotate: { x: degToRad(rotation.x), y: degToRad(rotation.y), z: degToRad(rotation.z) } })
        }, { step: '1' }),
        this._createNumberInput('Rotate Z', rotation.z, (value) => {
          rotation.z = Number(value)
          this.onChange({ rotate: { x: degToRad(rotation.x), y: degToRad(rotation.y), z: degToRad(rotation.z) } })
        }, { step: '1' })
      ])

      this.form.appendChild(generalSection)
      this.form.appendChild(appearanceSection)
      this.form.appendChild(offsetSection)
      this.form.appendChild(rotationSection)

      const nodesSection = this._createNodesSection(object)
      if (nodesSection) {
        this.form.appendChild(nodesSection)
      }
    }

    this.root = createPanel({
      title: 'Properties',
      content: container
    })

    return this.root
  }

  _createInput(label, value, onInput, type = 'text', attrs = {}) {
    const wrapper = document.createElement('label')
    wrapper.classList.add('properties-field')

    const span = document.createElement('span')
    span.textContent = label

    const input = document.createElement('input')
    input.type = type
    input.value = value
    Object.entries(attrs).forEach(([key, val]) => input.setAttribute(key, val))

    input.addEventListener('input', (event) => onInput(event.target.value))

    wrapper.appendChild(span)
    wrapper.appendChild(input)
    return wrapper
  }

  _createNumberInput(label, value, onInput, attrs = {}) {
    return this._createInput(label, value, (val) => onInput(val), 'number', attrs)
  }

  _createColorInput(label, value, onInput) {
    const wrapper = document.createElement('label')
    wrapper.classList.add('properties-field')

    const span = document.createElement('span')
    span.textContent = label

    const controls = document.createElement('div')
    controls.classList.add('properties-field__inline')

    const colorInput = document.createElement('input')
    colorInput.type = 'color'
    colorInput.value = /^#[0-9a-fA-F]{6}$/i.test(value) ? value : '#ffffff'
    colorInput.addEventListener('input', (event) => {
      const next = event.target.value
      textInput.value = next
      onInput(next)
    })

    const textInput = document.createElement('input')
    textInput.type = 'text'
    textInput.value = value || ''
    textInput.placeholder = '#000000 or none'
    textInput.addEventListener('change', (event) => {
      const next = event.target.value.trim()
      onInput(next)
      if (/^#[0-9a-fA-F]{6}$/i.test(next)) {
        colorInput.value = next
      }
    })

    controls.appendChild(colorInput)
    controls.appendChild(textInput)

    wrapper.appendChild(span)
    wrapper.appendChild(controls)
    return wrapper
  }

  _createSection(title, fields = []) {
    const section = document.createElement('fieldset')
    section.classList.add('properties-section')

    if (title) {
      const legend = document.createElement('legend')
      legend.textContent = title
      section.appendChild(legend)
    }

    fields.filter(Boolean).forEach(field => section.appendChild(field))
    return section
  }

  _createNodesSection(object) {
    if (object.type === 'group' || object.svg_element === 'g') {
      return null
    }

    const section = document.createElement('fieldset')
    section.classList.add('properties-section')

    const legend = document.createElement('legend')
    legend.textContent = 'Nodes'
    section.appendChild(legend)

    const info = document.createElement('p')
    info.style.margin = '0 0 0.75rem 0'
    info.style.fontSize = '0.8rem'
    info.style.color = 'var(--text-secondary)'

    const nodeCount = Array.isArray(object.nodes) ? object.nodes.length : 0
    info.textContent = `${nodeCount} ${nodeCount === 1 ? 'node' : 'nodes'}`
    section.appendChild(info)

    const controls = document.createElement('div')
    controls.style.display = 'flex'
    controls.style.gap = '0.5rem'

    const addBtn = createButton({
      label: 'Add Node',
      variant: 'ghost',
      onClick: (event) => {
        event.preventDefault()
        if (typeof this.onAddNode === 'function') {
          this.onAddNode()
        }
      },
      disabled: typeof this.onAddNode !== 'function'
    })

    controls.appendChild(addBtn)
    section.appendChild(controls)

    return section
  }
}
