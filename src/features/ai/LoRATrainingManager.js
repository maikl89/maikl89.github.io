/**
 * LoRATrainingManager - Coordinates LoRA training workflows
 */

export class LoRATrainingManager {
  constructor({ client }) {
    if (!client) {
      throw new Error('InferenceClient instance is required')
    }
    this.client = client
    this.jobs = new Map()
  }

  async startTraining(payload) {
    const response = await this.client.startJob(payload)
    if (response.jobId) {
      this.jobs.set(response.jobId, { status: 'queued', ...response })
    }
    return response
  }

  async refreshJob(jobId) {
    const job = await this.client.getJob(jobId)
    this.jobs.set(jobId, job)
    return job
  }

  async listJobs() {
    const list = await this.client.listJobs()
    list.forEach(job => this.jobs.set(job.jobId, job))
    return list
  }

  async listAdapters() {
    return this.client.listAdapters()
  }

  async setCurrentAdapter(name) {
    return this.client.setCurrentAdapter(name)
  }

  async deleteAdapter(name) {
    return this.client.deleteAdapter(name)
  }

  async getCurrentAdapter() {
    return this.client.getCurrentAdapter()
  }
}
