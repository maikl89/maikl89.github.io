/**
 * FirebaseClient - Minimal client for uploading project data to Firebase Realtime Database.
 *
 * This implementation uses the Firebase REST API, targeting a Realtime Database instance.
 * To enable uploads, provide the following configuration in App config:
 *
 * firebase: {
 *   databaseUrl: 'https://<PROJECT_ID>.firebaseio.com',
 *   authToken: '<database secret or auth token>' // optional if database rules allow unauthenticated write
 * }
 */

export class FirebaseClient {
  /**
   * @param {object} options
   * @param {string} options.databaseUrl - Firebase Realtime Database URL
   * @param {string} [options.authToken] - Optional auth token for secured databases
   * @param {Function} [options.fetchFn] - Optional fetch implementation (for testing)
   */
  constructor({ databaseUrl, authToken = '', fetchFn = null } = {}) {
    this.databaseUrl = databaseUrl
    this.authToken = authToken
    this.fetch = fetchFn || (typeof window !== 'undefined' ? window.fetch.bind(window) : null)
  }

  /**
   * Whether Firebase configuration is available.
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(this.databaseUrl && this.fetch)
  }

  /**
   * Upload a project document to Firebase Realtime Database.
   * The project is stored under `/projects/{projectId}`.
   *
  * @param {object} project - Project data to upload
  * @returns {Promise<Response>} fetch response
  */
  async uploadProject(project) {
    if (!this.isConfigured()) {
      throw new Error('Firebase client is not configured')
    }
    if (!project || !project.id) {
      throw new Error('Project with valid id is required')
    }

    const url = this._buildUrl(`/projects/${project.id}.json`)
    const response = await this.fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...project,
        uploadedAt: new Date().toISOString()
      })
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Firebase upload failed (${response.status}): ${text}`)
    }

    return response.json()
  }

  async fetchProjects() {
    if (!this.isConfigured()) {
      throw new Error('Firebase client is not configured')
    }

    const url = this._buildUrl('/projects.json')
    const response = await this.fetch(url, { method: 'GET' })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Firebase fetch failed (${response.status}): ${text}`)
    }

    const data = await response.json()
    if (!data) return []

    if (Array.isArray(data)) {
      return data.filter(Boolean)
    }

    return Object.entries(data).map(([id, value]) => ({
      ...(value || {}),
      id: value?.id || id
    }))
  }

  async deleteProject(projectId) {
    if (!this.isConfigured()) {
      throw new Error('Firebase client is not configured')
    }
    if (!projectId) {
      throw new Error('Project id is required')
    }

    const url = this._buildUrl(`/projects/${projectId}.json`)
    const response = await this.fetch(url, { method: 'DELETE' })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Firebase delete failed (${response.status}): ${text}`)
    }

    return response.json()
  }

  /**
   * Build URL with optional auth token.
   * @param {string} path - Path starting with '/'
   * @returns {string}
   */
  _buildUrl(path) {
    const base = this.databaseUrl.endsWith('/') ? this.databaseUrl.slice(0, -1) : this.databaseUrl
    let url = `${base}${path}`
    if (this.authToken) {
      const separator = url.includes('?') ? '&' : '?'
      url = `${url}${separator}auth=${encodeURIComponent(this.authToken)}`
    }
    return url
  }
}

export default FirebaseClient

