import type { PersonalityDefinition } from '../domain/types';

export const PERSONALITIES: readonly PersonalityDefinition[] = [
  { id: 'personality_bold', name: 'Bold', description: 'Hits hard and stands its ground.', statMultipliers: { power: 1.1, speed: 0.95 }, aiStyle: 'AGGRESSIVE' },
  { id: 'personality_calm', name: 'Calm', description: 'Channels resonance with patience.', statMultipliers: { resonance: 1.1, power: 0.96 }, aiStyle: 'SUPPORTIVE' },
  { id: 'personality_stalwart', name: 'Stalwart', description: 'Unusually difficult to crack.', statMultipliers: { defense: 1.1, speed: 0.94 }, aiStyle: 'DEFENSIVE' },
  { id: 'personality_hasty', name: 'Hasty', description: 'Acts before thinking, usually.', statMultipliers: { speed: 1.12, defense: 0.94 }, aiStyle: 'AGGRESSIVE' },
  { id: 'personality_precise', name: 'Precise', description: 'Polished focus with exceptional purity.', statMultipliers: { purity: 1.1, maxHp: 0.97 }, aiStyle: 'TACTICAL' },
  { id: 'personality_gentle', name: 'Gentle', description: 'Protects allies before itself.', statMultipliers: { resonance: 1.08, defense: 1.03, power: 0.94 }, aiStyle: 'SUPPORTIVE' },
  { id: 'personality_chaotic', name: 'Chaotic', description: 'No battle plan survives first contact.', statMultipliers: { power: 1.07, speed: 1.05, purity: 0.92 }, aiStyle: 'CHAOTIC' },
  { id: 'personality_sleepy', name: 'Sleepy', description: 'Eventually delivers a truly monumental hit.', statMultipliers: { power: 1.13, speed: 0.88, maxHp: 1.04 }, aiStyle: 'DEFENSIVE' },
] as const;

export const PERSONALITY_BY_ID: Readonly<Record<string, PersonalityDefinition>> = Object.freeze(
  Object.fromEntries(PERSONALITIES.map((definition) => [definition.id, definition])),
);
