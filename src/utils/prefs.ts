import { useState } from 'react';
import { readLocal, writeLocal } from '../net/session';
import { sounds } from './audio';

export const haptics = {
  enabled: readLocal('cluedo.haptics', true),
  /** A short buzz on phones that support it (not iOS Safari, which ignores it). */
  buzz(pattern: number | number[]) {
    if (!this.enabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some browsers throw until the page has been interacted with.
    }
  },
};

/** Sound and vibration switches, remembered on this device. */
export function usePrefs() {
  const [sound, setSound] = useState(sounds.enabled);
  const [buzz, setBuzz] = useState(haptics.enabled);
  return {
    sound,
    buzz,
    setSound(on: boolean) {
      sounds.enabled = on;
      writeLocal('cluedo.sound', on);
      setSound(on);
    },
    setBuzz(on: boolean) {
      haptics.enabled = on;
      writeLocal('cluedo.haptics', on);
      setBuzz(on);
      if (on) haptics.buzz(30);
    },
  };
}
