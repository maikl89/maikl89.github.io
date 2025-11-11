/**
 * ModuleLoader - Dynamically compiles module source code
 */

export class ModuleLoader {
  constructor(options = {}) {
    this.helpers = options.helpers || {}
  }

  /**
   * Compile module source into factory/build functions.
   * @param {string} source - Module source code
   * @returns {{ factory: Function, build: Function }}
   */
  compile(source) {
    if (typeof source !== 'string' || source.trim().length === 0) {
      throw new Error('Module source must be a non-empty string')
    }

    // Wrap source in a function to avoid global scope pollution
    const wrappedSource = `return (function ModuleFactory(helpers) {\n${source}\n})(helpers)`

    let factory
    try {
      // eslint-disable-next-line no-new-func
      const moduleFunction = new Function('helpers', wrappedSource)
      factory = moduleFunction(this.helpers)
    } catch (error) {
      console.error('Failed to compile module source:', error)
      throw new Error(`Module compilation failed: ${error.message}`)
    }

    if (typeof factory !== 'function') {
      throw new Error('Module source did not return a factory function')
    }

    const build = factory(this.helpers)
    if (typeof build !== 'function') {
      throw new Error('Module factory did not return a build function')
    }

    return { factory, build }
  }

  /**
   * Execute module build function.
   * @param {Function} build - Build function returned by compile()
   * @param {object} config - Module configuration
   * @param {object} state - Module state
   * @param {object} options - Additional options
   * @returns {object} Module result
   */
  run(build, config = {}, state = {}, options = {}) {
    if (typeof build !== 'function') {
      throw new Error('Build must be a function')
    }

    return build({ x: 0, y: 0, z: 0 }, config, state, options)
  }
}
