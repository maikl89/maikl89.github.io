/**
 * PoseDetectionService - Handles pose detection API calls
 */

export class PoseDetectionService {
  constructor({ client }) {
    if (!client) {
      throw new Error('InferenceClient instance is required')
    }
    this.client = client
  }

  detect(imageBase64, options = {}) {
    if (!imageBase64) {
      return Promise.reject(new Error('Image data is required'))
    }
    return this.client.fetchPoseDetection(imageBase64, options)
  }
}
