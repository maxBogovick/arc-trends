export const SUPPORTED_PET_ACTION_IDS = [
  'feed',
  'bathe',
  'heal',
  'play',
  'play_puzzle',
  'play_social',
  'bond',
  'bond_listen',
  'bond_praise',
  'sleep',
  'sleep_nap',
  'sleep_ritual',
] as const;

export type SupportedPetActionId = typeof SUPPORTED_PET_ACTION_IDS[number];

const SUPPORTED_ACTION_SET = new Set<string>(SUPPORTED_PET_ACTION_IDS);

export function isSupportedPetActionId(actionId: string): actionId is SupportedPetActionId {
  return SUPPORTED_ACTION_SET.has(actionId);
}
