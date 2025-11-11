const CONTROL_SCALE = 3

const DEFAULT_CONFIG = {
  version: '0.1.0-alpha',
  // ReferenceError: Can't find variable: process
  environment: 'development',
  storageKey: 'preview2-state',
  defaultZoom: 200,
  stage: {
    width: 1920 * 1,
    height: 1080 * 1
  },
  api: {
    baseUrl: 'http://localhost:8000/api/v1',
    timeout: 30000
  },
  firebase: {
    databaseUrl: '',
    authToken: ''
  },
  controls: {
    // Handle sizes (in pixels, will be compensated by zoom scale)
    handleRadius: 4 * CONTROL_SCALE,
    originRadius: 6 * CONTROL_SCALE,
    // Stroke widths (in pixels, will be compensated by zoom scale)
    handleStrokeWidth: 1.5 * CONTROL_SCALE,
    originStrokeWidth: 2 * CONTROL_SCALE,
    lineStrokeWidth: 1 * CONTROL_SCALE,
    // Label settings
    labelFontSize: 10 * CONTROL_SCALE,
    labelOffset: 6 * CONTROL_SCALE,
    // Dash array for lines (in pixels, will be compensated by zoom scale)
    lineDashSize: 2 * CONTROL_SCALE,
    bboxDashSize: 5 * CONTROL_SCALE
  }
}

/**
 * Retrieve the application configuration.
 * Allows partial overrides when constructing the app.
 *
 * @param {object} overrides - Partial configuration overrides
 * @returns {object} - Merged configuration object
 */
export function createConfig(overrides = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    api: {
      ...DEFAULT_CONFIG.api,
      ...(overrides.api || {})
    },
    firebase: {
      ...DEFAULT_CONFIG.firebase,
      ...(overrides.firebase || {})
    }
  }
}

export default DEFAULT_CONFIG
