/**
 * Panel component factory
 * Provides a container with optional header and content area.
 */

export function createPanel({
  title = '',
  className = '',
  content = null,
  actions = []
} = {}) {
  const panel = document.createElement('section')
  panel.classList.add('ui-panel')
  if (className) {
    panel.classList.add(className)
  }

  if (title) {
    const header = document.createElement('header')
    header.classList.add('ui-panel__header')

    const heading = document.createElement('h2')
    heading.textContent = title
    header.appendChild(heading)

    if (Array.isArray(actions) && actions.length > 0) {
      const actionContainer = document.createElement('div')
      actionContainer.classList.add('ui-panel__actions')
      actions.forEach(action => {
        if (action instanceof Element) {
          actionContainer.appendChild(action)
        }
      })
      header.appendChild(actionContainer)
    }

    panel.appendChild(header)
  }

  const body = document.createElement('div')
  body.classList.add('ui-panel__body')

  if (content instanceof Element) {
    body.appendChild(content)
  } else if (typeof content === 'string') {
    body.innerHTML = content
  }

  panel.appendChild(body)
  return panel
}
