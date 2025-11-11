/**
 * TimelinePanel - Placeholder timeline UI
 */

import { createPanel } from '../components/Panel.js'
import { createButton } from '../components/Button.js'

export class TimelinePanel {
  constructor({ onPlayPause = () => {}, onStop = () => {} } = {}) {
    this.onPlayPause = onPlayPause
    this.onStop = onStop
  }

  render() {
    const wrapper = document.createElement('div')
    wrapper.classList.add('timeline-panel')

    const controls = document.createElement('div')
    controls.classList.add('timeline-controls')

    const playButton = createButton({
      label: 'Play/Pause',
      variant: 'primary',
      onClick: this.onPlayPause
    })

    const stopButton = createButton({
      label: 'Stop',
      variant: 'ghost',
      onClick: this.onStop
    })

    controls.appendChild(playButton)
    controls.appendChild(stopButton)

    const track = document.createElement('div')
    track.classList.add('timeline-track')
    track.innerHTML = '<p>Timeline visualization will appear here.</p>'

    wrapper.appendChild(controls)
    wrapper.appendChild(track)

    return createPanel({
      title: 'Timeline',
      content: wrapper
    })
  }
}
