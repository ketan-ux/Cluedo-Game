import React from 'react';
import { BookOpen } from 'lucide-react';
import { Modal, SectionTitle } from './Modal';

const RULES: Array<{ title: string; points: string[] }> = [
  {
    title: 'The mystery',
    points: [
      'One suspect, one weapon and one room are sealed in the envelope at the start. Everything else is dealt out.',
      'Your cards are innocent: if you hold it, it is not in the envelope.',
    ],
  },
  {
    title: 'Your turn',
    points: [
      'Roll both dice and move exactly that many squares along the corridors, up, down or sideways, never diagonally and never onto the same square twice.',
      'You can enter a room through a door with steps to spare; moving stops there. Leaving a room takes one step and you cannot come back into it on the same turn.',
      'From a corner room you may take the secret passage to the opposite corner instead of rolling.',
      'If another player brought you into a room with their suggestion, you may suggest there on your turn without moving.',
    ],
  },
  {
    title: 'Suggestions',
    points: [
      'After entering a room you may suggest who did it and with what. The room is always the one you are in, and the suspect and weapon you name are brought there.',
      'Players to your left, in turn, must show you one matching card if they can. Only you see it; everyone else only sees that a card was shown.',
      'The first player who can disprove it shows exactly one card, and no one else is asked.',
    ],
  },
  {
    title: 'Accusations',
    points: [
      'On your turn, wherever you are, you may accuse: name a suspect, weapon and room, then look in the envelope. You only get one try.',
      'All three right and you win. Anything wrong and you are out, though you still show cards to disprove others.',
      'If everyone accuses wrongly, the murderer gets away.',
    ],
  },
  {
    title: 'Detective notes',
    points: [
      'Your notebook fills in what you know for certain and locks it. Tap any other box to mark it ✓ has, ✗ hasn’t or ? maybe.',
    ],
  },
];

export function RulesSheet({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play" subtitle="The classic rules, enforced by the table." icon={<BookOpen className="w-5 h-5" />} onClose={onClose} wide tall>
      {RULES.map((section) => (
        <section key={section.title} className="space-y-2">
          <SectionTitle>{section.title}</SectionTitle>
          <ul className="space-y-1.5 text-[15px] leading-snug font-serif-vintage text-[var(--parchment)]">
            {section.points.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="text-[var(--gold)] mt-[0.1em]">◆</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Modal>
  );
}
