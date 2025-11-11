import { createPanel } from '../components/Panel.js'

export class SettingsPanel {
  constructor({ controlScale = 1, onControlScaleChange = () => {} } = {}) {
    this.controlScale = this._sanitizeScale(controlScale)
    this.onControlScaleChange = onControlScaleChange

    this.root = null
    this.scaleSlider = null
    this.scaleInput = null
    this.scaleLabel = null
  }

  render() {
    const container = document.createElement('div')
    container.classList.add('settings-panel')

    const section = document.createElement('div')
    section.classList.add('settings-panel__section')
    section.style.display = 'flex'
    section.style.flexDirection = 'column'
    section.style.gap = '0.5rem'

    const title = document.createElement('label')
    title.textContent = 'Control Handle Size'
    title.style.fontSize = '0.75rem'
    title.style.color = 'var(--text-secondary)'
    title.style.display = 'block'

    const controlsRow = document.createElement('div')
    controlsRow.style.display = 'flex'
    controlsRow.style.alignItems = 'center'
    controlsRow.style.gap = '0.5rem'

    this.scaleSlider = document.createElement('input')
    this.scaleSlider.type = 'range'
    this.scaleSlider.min = '0.5'
    this.scaleSlider.max = '6'
    this.scaleSlider.step = '0.1'
    this.scaleSlider.value = String(this.controlScale)
    this.scaleSlider.style.flex = '1'
    this.scaleSlider.addEventListener('input', (event) => {
      const value = this._sanitizeScale(parseFloat(event.target.value))
      this._setControlScale(value, { emit: true })
    })

    this.scaleInput = document.createElement('input')
    this.scaleInput.type = 'number'
    this.scaleInput.min = '0.5'
    this.scaleInput.max = '6'
    this.scaleInput.step = '0.1'
    this.scaleInput.value = String(this.controlScale)
    this.scaleInput.style.width = '64px'
    this.scaleInput.addEventListener('change', (event) => {
      const value = this._sanitizeScale(parseFloat(event.target.value))
      this._setControlScale(value, { emit: true })
    })

    this.scaleLabel = document.createElement('div')
    this.scaleLabel.style.fontSize = '0.7rem'
    this.scaleLabel.style.color = 'var(--text-secondary)'
    this.scaleLabel.textContent = `${this.controlScale.toFixed(1)}×`

    controlsRow.appendChild(this.scaleSlider)
    controlsRow.appendChild(this.scaleInput)
    controlsRow.appendChild(this.scaleLabel)

    section.appendChild(title)
    section.appendChild(controlsRow)
    container.appendChild(section)

    this.root = createPanel({
      title: 'Settings',
      content: container
    })

    return this.root
  }

  setControlScale(scale) {
    const sanitized = this._sanitizeScale(scale)
    this._setControlScale(sanitized, { emit: false })
  }

  _setControlScale(scale, { emit } = { emit: false }) {
    this.controlScale = scale

    if (this.scaleSlider) {
      this.scaleSlider.value = String(scale)
    }
    if (this.scaleInput) {
      this.scaleInput.value = String(scale)
    }
    if (this.scaleLabel) {
      this.scaleLabel.textContent = `${scale.toFixed(1)}×`
    }

    if (emit && typeof this.onControlScaleChange === 'function') {
      this.onControlScaleChange(scale)
    }
  }

  _sanitizeScale(value) {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return 1
    }
    return Math.min(6, Math.max(0.5, value))
  }
}

export default SettingsPanel

