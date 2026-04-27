import { defaultPersona } from './default.js';
import { emotionalDamageDadPersona } from './emotional-damage-dad.js';
import type { PersonaKey, PersonaRenderer } from './types.js';

const PERSONA_MAP: Record<PersonaKey, PersonaRenderer> = {
  default: defaultPersona,
  'emotional-damage-dad': emotionalDamageDadPersona,
};

export const PERSONA_KEYS: PersonaKey[] = Object.keys(PERSONA_MAP) as PersonaKey[];

export function getPersona(key: PersonaKey | undefined): PersonaRenderer {
  if (key && key in PERSONA_MAP) {
    return PERSONA_MAP[key as PersonaKey];
  }
  return defaultPersona;
}

export function isValidPersona(key: string): key is PersonaKey {
  return key in PERSONA_MAP;
}

export type { PersonaKey, PersonaRenderer } from './types.js';
export { defaultPersona, emotionalDamageDadPersona };
