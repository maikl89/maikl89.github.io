/**
 * ModifierGenerator - Generates modifier descriptors for context items
 */

export class ModifierGenerator {
  generate({ property, delta = {}, probability = 0.5, reason = null }) {
    if (!property) {
      throw new Error('property is required')
    }

    return {
      property,
      delta,
      probability,
      reason: reason || {
        summary: `Animates ${property}`,
        weight: probability
      }
    }
  }
}
