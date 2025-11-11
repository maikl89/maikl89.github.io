/**
 * PoseVisualizer - Draws pose data overlays on a canvas
 */

export class PoseVisualizer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas ? canvas.getContext('2d') : null
    this.strokeStyle = '#38bdf8'
    this.keypointStyle = '#facc15'
    this.lineWidth = 2
  }

  setCanvas(canvas) {
    this.canvas = canvas
    this.ctx = canvas ? canvas.getContext('2d') : null
  }

  resize(width, height) {
    if (!this.canvas) return
    this.canvas.width = width
    this.canvas.height = height
  }

  clear() {
    if (!this.ctx) return
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  draw(poseData) {
    if (!this.ctx || !poseData || !poseData.poses || poseData.poses.length === 0) {
      return
    }

    this.clear()
    poseData.poses.forEach(pose => {
      if (!pose || !Array.isArray(pose.keypoints)) return
      this._drawSkeleton(pose.keypoints)
      this._drawKeypoints(pose.keypoints)
    })
  }

  _drawSkeleton(keypoints) {
    const connections = PoseVisualizer.SKELETON_CONNECTIONS
    this.ctx.strokeStyle = this.strokeStyle
    this.ctx.lineWidth = this.lineWidth
    this.ctx.globalAlpha = 0.8

    connections.forEach(([startName, endName]) => {
      const start = keypoints.find(k => k.name === startName)
      const end = keypoints.find(k => k.name === endName)

      if (!start || !end) return
      if (start.confidence < 0.2 || end.confidence < 0.2) return

      this.ctx.beginPath()
      this.ctx.moveTo(start.x, start.y)
      this.ctx.lineTo(end.x, end.y)
      this.ctx.stroke()
    })
  }

  _drawKeypoints(keypoints) {
    this.ctx.fillStyle = this.keypointStyle
    this.ctx.globalAlpha = 1

    keypoints.forEach(point => {
      if (!point || point.confidence < 0.2) return
      this.ctx.beginPath()
      this.ctx.arc(point.x, point.y, 3, 0, Math.PI * 2)
      this.ctx.fill()
    })
  }
}

PoseVisualizer.SKELETON_CONNECTIONS = [
  ['nose', 'left_eye'], ['nose', 'right_eye'],
  ['left_eye', 'left_ear'], ['right_eye', 'right_ear'],
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'], ['right_knee', 'right_ankle']
]
