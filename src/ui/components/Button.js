/**
 * Button component factory
 * Provides a simple styled button with event binding.
 */

export function createButton({
  label = 'Button',
  type = 'button',
  variant = 'primary',
  onClick = null,
  disabled = false
} = {}) {
  const button = document.createElement('button')
  button.type = type
  button.textContent = label
  button.classList.add('ui-btn', `ui-btn--${variant}`)
  button.disabled = disabled

  if (typeof onClick === 'function') {
    button.addEventListener('click', onClick)
  }

  return button
}
