/**
 * PoseToObject - Converts pose data into animation objects
 */

export class PoseToObject {
  constructor({ scale = 1, offset = { x: 0, y: 0 } } = {}) {
    this.scale = scale
    this.offset = offset
  }

  convert(poseData, { generateParts = false } = {}) {
    if (!poseData || !poseData.poses || poseData.poses.length === 0) {
      return []
    }

    const objects = []

    poseData.poses.forEach((pose, index) => {
      const baseObject = this._createBaseObject(pose, index)
      objects.push(baseObject)

      if (generateParts && pose.parts) {
        Object.entries(pose.parts).forEach(([partName, partData], partIndex) => {
          objects.push(this._createPartObject(pose, partName, partData, index, partIndex))
        })
      }
    })

    return objects
  }

  _createBaseObject(pose, poseIndex) {
    const nodes = this._buildPathNodes(pose.keypoints)

    return {
      id: `pose_${poseIndex}`,
      name: `Pose ${poseIndex + 1}`,
      type: 'object',
      svg_element: 'path',
      nodes,
      closed: false,
      opacity: 1,
      fill: 'none',
      stroke: '#38bdf8',
      strokeWidth: 2,
      metadata: {
        source: 'pose_detection',
        confidence: pose.confidence
      }
    }
  }

  _createPartObject(pose, partName, partData, poseIndex, partIndex) {
    const nodes = this._buildPathNodes(partData.keypoints || [])

    return {
      id: `pose_${poseIndex}_${partIndex}`,
      name: `${partName} ${poseIndex + 1}`,
      type: 'object',
      svg_element: 'path',
      nodes,
      closed: false,
      opacity: 1,
      fill: 'none',
      stroke: '#f97316',
      strokeWidth: 2,
      metadata: {
        source: 'pose_detection',
        part: partName,
        confidence: pose.confidence
      }
    }
  }

  _buildPathNodes(keypoints) {
    const order = PoseToObject.DEFAULT_PATH_ORDER
    const keypointMap = new Map(keypoints.map(k => [k.name, k]))

    const nodes = order
      .map(name => keypointMap.get(name))
      .filter(Boolean)
      .map(point => this._createNode(point))

    if (nodes.length < 2) {
      return keypoints.map(point => this._createNode(point)).slice(0, 2)
    }

    return nodes
  }

  _createNode(point) {
    return {
      x: point.x * this.scale + this.offset.x,
      y: point.y * this.scale + this.offset.y
    }
  }
}

PoseToObject.DEFAULT_PATH_ORDER = [
  'left_ankle', 'left_knee', 'left_hip',
  'right_hip', 'right_knee', 'right_ankle',
  'right_wrist', 'right_elbow', 'right_shoulder',
  'left_shoulder', 'left_elbow', 'left_wrist',
  'left_ear', 'left_eye', 'nose', 'right_eye', 'right_ear'
]
