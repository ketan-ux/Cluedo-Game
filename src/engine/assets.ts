import { Card, Suspect, Weapon, Room, ALL_SUSPECTS, ALL_WEAPONS, ALL_ROOMS, SUSPECT_COLORS } from '../types/cluedo';

export interface CharacterDetail {
  name: Suspect;
  title: string;
  occupation: string;
  bio: string;
  color: string;
  tokenBg: string;
  portraitSvg: string;
}

export const CHARACTER_DETAILS: Record<Suspect, CharacterDetail> = {
  'Miss Scarlet': {
    name: 'Miss Scarlet',
    title: 'The Femme Fatale',
    occupation: 'Actress & Socialite',
    bio: 'Dressed in a striking crimson gown with a silver cigarette holder, she navigates high society with cold calculation.',
    color: '#dc2626',
    tokenBg: '#991b1b',
    portraitSvg: 'scarlet',
  },
  'Colonel Mustard': {
    name: 'Colonel Mustard',
    title: 'The Decorated Officer',
    occupation: 'Retired Military Commander',
    bio: 'Sporting a stiff bristled mustache and golden service medals, his proud military exterior hides buried wartime secrets.',
    color: '#d97706',
    tokenBg: '#b45309',
    portraitSvg: 'mustard',
  },
  'Mrs. White': {
    name: 'Mrs. White',
    title: 'The Discreet Housekeeper',
    occupation: 'Head of Domestic Staff',
    bio: 'Keeper of the Tudor Close keys. In her stark black dress and crisp apron, she knows every locked drawer and cellar whisper.',
    color: '#e2e8f0',
    tokenBg: '#64748b',
    portraitSvg: 'white',
  },
  'Mr. Green': {
    name: 'Mr. Green',
    title: 'The Shrewd Fixer',
    occupation: 'Con Man & Private Broker',
    bio: 'Silk emerald tie beneath a double-breasted suit and tilted fedora. Money talks, but dead men tell no tales.',
    color: '#059669',
    tokenBg: '#047857',
    portraitSvg: 'green',
  },
  'Mrs. Peacock': {
    name: 'Mrs. Peacock',
    title: 'The Wealthy Dowager',
    occupation: 'High Society Heiress',
    bio: 'Adorned in royal sapphire feathers and triple-strand pearls, she defends her family fortune with venomous elegance.',
    color: '#0284c7',
    tokenBg: '#0369a1',
    portraitSvg: 'peacock',
  },
  'Professor Plum': {
    name: 'Professor Plum',
    title: 'The Eccentric Academic',
    occupation: 'Archaeologist & Author',
    bio: 'Wearing round wireframe spectacles and a worn tweed jacket with purple velvet lapels. Fascinated by deadly poisons and ancient relics.',
    color: '#7e22ce',
    tokenBg: '#6b21a8',
    portraitSvg: 'plum',
  },
};

export const WEAPON_DETAILS: Record<Weapon, { description: string; icon: string; material: string }> = {
  Candlestick: {
    description: 'A solid, ornate brass candlestick, heavy enough to deliver a fatal blow.',
    icon: 'Candlestick',
    material: 'Polished Brass',
  },
  Dagger: {
    description: 'An antique damascus steel stiletto blade with an engraved bone hilt.',
    icon: 'Dagger',
    material: 'Forged Steel',
  },
  'Lead Pipe': {
    description: 'A tarnished section of heavy industrial plumbing torn from the cellar.',
    icon: 'Lead Pipe',
    material: 'Heavy Lead',
  },
  Revolver: {
    description: 'A vintage .38 caliber 6-shot service revolver with mother-of-pearl grip.',
    icon: 'Revolver',
    material: 'Blued Steel',
  },
  Rope: {
    description: 'A length of thick maritime braided hemp coil tied in a sinister knot.',
    icon: 'Rope',
    material: 'Braided Hemp',
  },
  Wrench: {
    description: 'A heavy forged mechanic spanner covered in grease and dark stains.',
    icon: 'Wrench',
    material: 'Cast Iron',
  },
};

export function createDeck(): Card[] {
  const cards: Card[] = [];

  // Suspect Cards (6)
  for (const s of ALL_SUSPECTS) {
    cards.push({
      id: `suspect_${s.toLowerCase().replace(/[\s.]+/g, '_')}`,
      type: 'SUSPECT',
      name: s,
      assetPath: `/assets/cards/suspect_${s.toLowerCase().replace(/[\s.]+/g, '_')}.png`,
      color: SUSPECT_COLORS[s].hex,
      subtitle: CHARACTER_DETAILS[s].title,
    });
  }

  // Weapon Cards (6)
  for (const w of ALL_WEAPONS) {
    cards.push({
      id: `weapon_${w.toLowerCase().replace(/\s+/g, '_')}`,
      type: 'WEAPON',
      name: w,
      assetPath: `/assets/cards/weapon_${w.toLowerCase().replace(/\s+/g, '_')}.png`,
      color: '#d4af37',
      subtitle: WEAPON_DETAILS[w].material,
    });
  }

  // Room Cards (9)
  for (const r of ALL_ROOMS) {
    cards.push({
      id: `room_${r.toLowerCase().replace(/\s+/g, '_')}`,
      type: 'ROOM',
      name: r,
      assetPath: `/assets/cards/room_${r.toLowerCase().replace(/\s+/g, '_')}.png`,
      color: '#c59b27',
      subtitle: 'Mansion Chamber',
    });
  }

  return cards;
}

export const MASTER_DECK: Card[] = createDeck();

export function getCardById(cardId: string): Card | undefined {
  return MASTER_DECK.find((c) => c.id === cardId);
}

export function getCardByName(name: Suspect | Weapon | Room): Card {
  const card = MASTER_DECK.find((c) => c.name === name);
  if (!card) throw new Error(`Card with name ${name} not found in master deck`);
  return card;
}
