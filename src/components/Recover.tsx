import React, { Component, ErrorInfo } from 'react';
import { RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  /** Bumped to remount the screen from scratch. */
  attempt: number;
  givenUp: boolean;
}

/**
 * Catches a crash anywhere in the current screen and draws it again from the latest room state,
 * instead of React unmounting everything and leaving a blank page. The game itself lives on the
 * server, so nothing is lost. If it keeps crashing, offer a reload.
 */
export class Recover extends Component<Props, State> {
  state: State = { error: null, attempt: 0, givenUp: false };
  private crashes: number[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The screen crashed; drawing it again.', error, info.componentStack);
    const now = Date.now();
    this.crashes = [...this.crashes.filter((t) => now - t < 30_000), now];
    if (this.crashes.length > 3) {
      this.setState({ givenUp: true });
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 })), 50);
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  render() {
    if (this.state.givenUp) {
      return (
        <div role="alert" className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="font-deco font-bold text-lg text-[var(--gold-light)]">Something went wrong on this screen.</p>
          <p className="italic text-[var(--muted)] max-w-sm">Your game is safe on the server. Reload to pick up where you left off.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 px-5 rounded-xl bg-[var(--gold)] text-[#1f120a] font-deco font-bold text-xs uppercase tracking-wider flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Reload
          </button>
          <p className="text-xs font-mono text-[var(--muted)]/70 max-w-sm break-words">{this.state.error?.message}</p>
        </div>
      );
    }
    if (this.state.error) return null;
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}
