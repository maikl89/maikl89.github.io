/**
 * Modal component factory
 * Provides a simple modal dialog with overlay.
 */

import { createButton } from './Button.js'

export function createModal({
  title = '',
  content = '',
  actions = [],
  onClose = null
} = {}) {
  const overlay = document.createElement('div')
  overlay.classList.add('ui-modal__overlay')

  const modal = document.createElement('div')
  modal.classList.add('ui-modal')

  const header = document.createElement('header')
  header.classList.add('ui-modal__header')

  const heading = document.createElement('h3')
  heading.textContent = title
  header.appendChild(heading)

  const closeBtn = createButton({
    label: '×',
    variant: 'ghost',
    onClick: () => close()
  })
  closeBtn.classList.add('ui-modal__close')
  header.appendChild(closeBtn)

  const body = document.createElement('div')
  body.classList.add('ui-modal__body')
  if (content instanceof Element) {
    body.appendChild(content)
  } else {
    body.innerHTML = content
  }

  const footer = document.createElement('footer')
  footer.classList.add('ui-modal__footer')
  actions.forEach(action => {
    if (action instanceof Element) {
      footer.appendChild(action)
    }
  })

  modal.appendChild(header)
  modal.appendChild(body)
  modal.appendChild(footer)
  overlay.appendChild(modal)

  function close() {
    overlay.remove()
    if (typeof onClose === 'function') {
      onClose()
    }
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close()
    }
  })

  return { overlay, close }
}
