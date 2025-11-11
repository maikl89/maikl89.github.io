/**
 * InferenceClient - Handles communication with the AI backend
 */

export class InferenceClient {
  constructor({ baseUrl = 'http://localhost:8000/api/v1', timeout = 30000 } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.timeout = timeout
  }

  async _request(path, { method = 'GET', body = null } = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const message = errorData.error || errorData.message || `HTTP ${response.status}`
        throw new Error(message)
      }

      return response.json().catch(() => ({}))
    } finally {
      clearTimeout(timer)
    }
  }

  callInference({ instruction, logId = null }) {
    return this._request('/inference', {
      method: 'POST',
      body: { instruction, logId }
    })
  }

  fetchStats() {
    return this._request('/stats')
  }

  fetchLogs(logId) {
    return this._request(`/logs/${logId}`)
  }

  listModules() {
    return this._request('/modules')
  }

  listJobs() {
    return this._request('/training/jobs')
  }

  getJob(jobId) {
    return this._request(`/training/jobs/${jobId}`)
  }

  startJob(payload) {
    return this._request('/training/train', {
      method: 'POST',
      body: payload
    })
  }

  listAdapters() {
    return this._request('/training/adapters')
  }

  getCurrentAdapter() {
    return this._request('/training/adapters/current')
  }

  setCurrentAdapter(name) {
    return this._request('/training/adapters/current', {
      method: 'PUT',
      body: { name }
    })
  }

  deleteAdapter(name) {
    return this._request(`/training/adapters/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    })
  }

  fetchPoseDetection(image, options = {}) {
    return this._request('/pose/detect', {
      method: 'POST',
      body: { image, ...options }
    })
  }
}
