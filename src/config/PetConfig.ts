import type { PetConfig } from "../types/pet";

export function createDefaultPetConfig(): PetConfig {
  return {
    petId: "puppy",
    name: "콩이",
    appearance: {
      type: "puppy",
      scale: 1,
    },
    position: {
      x: 200,
      y: 200,
    },
    personality: {
      energy: 0.5,
      friendliness: 0.6,
      curiosity: 0.5,
      sleepiness: 0.4,
      playfulness: 0.6,
    },
    behavior: {
      walking: false,
      running: true,
      sitting: false,
      sleeping: true,
      yawning: true,
      lookAtCursor: true,
      followCursor: false,
      suddenDash: true,
      cursorInteraction: true,
      dragging: true,
    },
    activityLevel: 0.5,
    moveSpeed: 1,
    rules: [],
  };
}

/** Shallow+nested merge of a persisted/partial config on top of defaults,
 * so adding new fields later never breaks older saved config files. */
export function mergeWithDefaults(partial: Partial<PetConfig> | null | undefined): PetConfig {
  const defaults = createDefaultPetConfig();
  if (!partial) return defaults;

  return {
    ...defaults,
    ...partial,
    appearance: { ...defaults.appearance, ...partial.appearance },
    position: { ...defaults.position, ...partial.position },
    personality: { ...defaults.personality, ...partial.personality },
    behavior: { ...defaults.behavior, ...partial.behavior },
    rules: partial.rules ?? defaults.rules,
  };
}
