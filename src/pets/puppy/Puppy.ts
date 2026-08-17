import type { PetDefinition } from "../../types/pet";
import { PUPPY_DEFINITION } from "./puppy.config";

// Registry of all playable pets. Adding a new species later means adding a
// new folder under src/pets/<species>/ and one line here.
export const PET_DEFINITIONS: Record<string, PetDefinition> = {
  puppy: PUPPY_DEFINITION,
};

export function getPetDefinition(petId: string): PetDefinition {
  return PET_DEFINITIONS[petId] ?? PUPPY_DEFINITION;
}
