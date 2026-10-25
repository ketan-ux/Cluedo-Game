import { GameView } from '../../game/view';
import { EventBatch } from '../../net/useRoom';

/** Props shared by the 2D and 3D boards so the game screen can swap them freely. */
export interface BoardProps {
  game: GameView;
  myId: string | null;
  batch: EventBatch;
  /** A destination picked on a touch screen, waiting for confirmation. */
  selected: string | null;
  onPick: (target: string, pointer: 'mouse' | 'touch') => void;
  onPassage: () => void;
}

let lastPointerType = 'mouse';
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => (lastPointerType = e.pointerType), { capture: true, passive: true });
}

/** Mouse clicks move straight away; taps select first, so a mis-tap on a small square is harmless. */
export function pointerKind(): 'mouse' | 'touch' {
  return lastPointerType === 'mouse' ? 'mouse' : 'touch';
}
