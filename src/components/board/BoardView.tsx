import React, { Component, lazy, Suspense, useState } from 'react';
import { readLocal, writeLocal } from '../../net/session';
import Board2D from './Board2D';
import { BoardProps } from './types';

// The 3D board (and three.js) downloads separately, so the first screen stays light.
const Board3D = lazy(() => import('../board3d/Board3D'));

export type BoardMode = '2d' | '3d';

function webglAvailable(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export function useBoardMode(): [BoardMode, (m: BoardMode) => void] {
  const [mode, setMode] = useState<BoardMode>(() => {
    const saved = readLocal<BoardMode | null>('cluedo.board', null);
    if (saved === '2d') return '2d';
    return webglAvailable() ? '3d' : '2d';
  });
  return [
    mode,
    (m) => {
      writeLocal('cluedo.board', m);
      setMode(m);
    },
  ];
}

class Fallback extends Component<{ fallback: React.ReactNode; onError: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error('3D board failed, using the 2D board instead', err);
    this.props.onError();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function BoardView({ mode, onUnsupported, ...props }: BoardProps & { mode: BoardMode; onUnsupported: () => void }) {
  const flat = <Board2D {...props} />;
  if (mode === '2d') return flat;
  return (
    <Fallback fallback={flat} onError={onUnsupported}>
      <Suspense fallback={flat}>
        <Board3D {...props} />
      </Suspense>
    </Fallback>
  );
}
