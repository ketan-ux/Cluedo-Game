import { CardName, cardKind, CardKind, Room, Suspect, Weapon } from './constants';

export const SUSPECT_LORE: Record<Suspect, { title: string; bio: string }> = {
  'Miss Scarlet': {
    title: 'The Femme Fatale',
    bio: 'Dressed in a striking crimson gown with a silver cigarette holder, she navigates high society with cold calculation.',
  },
  'Colonel Mustard': {
    title: 'The Decorated Officer',
    bio: 'Sporting a stiff bristled mustache and golden service medals, his proud military exterior hides buried wartime secrets.',
  },
  'Mrs. White': {
    title: 'The Discreet Housekeeper',
    bio: 'Keeper of the house keys. In her stark black dress and crisp apron, she knows every locked drawer and cellar whisper.',
  },
  'Mr. Green': {
    title: 'The Shrewd Fixer',
    bio: 'Silk emerald tie beneath a double-breasted suit and tilted fedora. Money talks, but dead men tell no tales.',
  },
  'Mrs. Peacock': {
    title: 'The Wealthy Dowager',
    bio: 'Adorned in royal sapphire feathers and triple-strand pearls, she defends her family fortune with venomous elegance.',
  },
  'Professor Plum': {
    title: 'The Eccentric Academic',
    bio: 'Round wireframe spectacles and a worn tweed jacket with purple velvet lapels. Fascinated by deadly poisons and ancient relics.',
  },
};

export const WEAPON_LORE: Record<Weapon, { material: string; description: string }> = {
  Candlestick: { material: 'Polished Brass', description: 'A solid, ornate brass candlestick, heavy enough to deliver a fatal blow.' },
  Dagger: { material: 'Forged Steel', description: 'An antique steel stiletto blade with an engraved bone hilt.' },
  'Lead Pipe': { material: 'Heavy Lead', description: 'A tarnished section of heavy plumbing torn from the cellar.' },
  Revolver: { material: 'Blued Steel', description: 'A vintage six-shot service revolver with a mother-of-pearl grip.' },
  Rope: { material: 'Braided Hemp', description: 'A length of thick braided hemp tied in a sinister knot.' },
  Wrench: { material: 'Cast Iron', description: 'A heavy forged spanner covered in grease and dark stains.' },
};

export const ROOM_LORE: Record<Room, { color: string; floor: string; description: string }> = {
  Kitchen: { color: '#7a4a2a', floor: '#c9b48a', description: 'Cast iron stoves, prep counters and meat hooks.' },
  Ballroom: { color: '#6d3b1f', floor: '#b8895a', description: 'A polished parquet dance floor under a crystal chandelier.' },
  Conservatory: { color: '#2f5d3a', floor: '#8fae86', description: 'A glass solarium filled with exotic ferns and statues.' },
  'Dining Room': { color: '#6b2430', floor: '#a8706b', description: 'A grand mahogany banquet table set with silver.' },
  'Billiard Room': { color: '#1f5134', floor: '#3f7a52', description: 'Heavy green baize table with antique cue racks.' },
  Library: { color: '#4a3266', floor: '#8a7aa0', description: 'Floor-to-ceiling tomes and rolling brass ladders.' },
  Lounge: { color: '#7a2222', floor: '#b5726a', description: 'Plush velvet armchairs facing a roaring fireplace.' },
  Hall: { color: '#7a5a1e', floor: '#c2a36a', description: 'A towering foyer with oil portraits and a grand clock.' },
  Study: { color: '#2e3a4a', floor: '#7d8a99', description: 'A roll-top desk, a wall safe and a private telephone.' },
};

export function cardSubtitle(card: CardName): string {
  const kind: CardKind = cardKind(card);
  if (kind === 'suspect') return SUSPECT_LORE[card as Suspect].title;
  if (kind === 'weapon') return WEAPON_LORE[card as Weapon].material;
  return ROOM_LORE[card as Room].description;
}
