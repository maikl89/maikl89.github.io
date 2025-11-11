/**
 * TimelineController - Coordinates timeline interactions
 * Placeholder for Phase 3; will integrate with UI timeline panel later.
 */

export class TimelineController {
  constructor(engine) {
    this.engine = engine
    this.selection = null
    this.snapInterval = 100 // milliseconds
    this.isScrubbing = false
  }

  selectObject(objectId) {
    this.selection = objectId
  }

  startScrub() {
    this.isScrubbing = true
    this.engine.pause()
  }

  scrubTo(time) {
    if (!this.isScrubbing) return
    this.engine.seek(time)
  }

  endScrub(play = false) {
    this.isScrubbing = false
    if (play) {
      this.engine.play()
    }
  }
}
