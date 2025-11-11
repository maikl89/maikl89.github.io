import App from './App.js'
import DEFAULT_CONFIG, { createConfig } from './config.js'

const app = new App({
  config: createConfig({
    version: DEFAULT_CONFIG.version
  })
})

window.addEventListener('DOMContentLoaded', () => {
  app.mount('#app')
})
