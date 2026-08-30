import React, { useState, useEffect } from 'react';
import { Card, MaskedPlayer, ALL_SUSPECTS, ALL_WEAPONS, ALL_ROOMS } from '../../types/cluedo';
import { BookOpen, Check, X, HelpCircle, XCircle, FileText, Sparkles } from 'lucide-react';
import { sounds } from '../../utils/audio';

interface DetectiveNotebookProps {
  isOpen: boolean;
  onClose: () => void;
  myHand: Card[];
  players: MaskedPlayer[];
  myPeerId?: string;
}

type CheckState = 'BLANK' | 'CHECK' | 'CROSS' | 'QUESTION';

export const DetectiveNotebook: React.FC<DetectiveNotebookProps> = ({
  isOpen,
  onClose,
  myHand,
  players,
  myPeerId,
}) => {
  // Grid state: Record<cardName, Record<playerPeerId, CheckState>>
  const [marks, setMarks] = useState<Record<string, Record<string, CheckState>>>({});
  const [customNotes, setCustomNotes] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'ALL' | 'SUSPECTS' | 'WEAPONS' | 'ROOMS'>('ALL');

  // Find local player ID
  const localPlayer = players.find(
    (p) => (myPeerId && p.peerId === myPeerId) || (p.hand !== undefined && myHand.length > 0)
  );

  // Pre-populate player's starting hand with checks in their own column
  useEffect(() => {
    if (!localPlayer) return;
    setMarks((prev) => {
      const next = { ...prev };
      for (const card of myHand) {
        if (!next[card.name]) next[card.name] = {};
        next[card.name][localPlayer.peerId] = 'CHECK';
      }
      return next;
    });
  }, [myHand, localPlayer]);

  // Keyboard shortcut Tab or N to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' || e.key === 'N') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const cycleState = (cardName: string, colId: string) => {
    sounds.playPencilMark();
    setMarks((prev) => {
      const current = prev[cardName]?.[colId] || 'BLANK';
      let nextState: CheckState = 'BLANK';
      if (current === 'BLANK') nextState = 'CHECK';
      else if (current === 'CHECK') nextState = 'CROSS';
      else if (current === 'CROSS') nextState = 'QUESTION';
      else if (current === 'QUESTION') nextState = 'BLANK';

      return {
        ...prev,
        [cardName]: {
          ...(prev[cardName] || {}),
          [colId]: nextState,
        },
      };
    });
  };

  const renderCheckIcon = (state: CheckState) => {
    switch (state) {
      case 'CHECK':
        return <Check className="w-4 h-4 text-emerald-800 font-black stroke-[3]" />;
      case 'CROSS':
        return <X className="w-4 h-4 text-red-800 font-black stroke-[3]" />;
      case 'QUESTION':
        return <HelpCircle className="w-4 h-4 text-amber-800 font-bold" />;
      default:
        return <span className="text-transparent">-</span>;
    }
  };

  if (!isOpen) return null;

  // Generate columns directly for each player in the match without artificial duplicate "Me"
  const columns = players.map((p) => {
    const isMe = (myPeerId && p.peerId === myPeerId) || (p.hand !== undefined && myHand.length > 0);
    return {
      id: p.peerId,
      name: p.name,
      character: p.character,
      isMe,
      label: isMe ? `${p.name} (You)` : p.name,
      subLabel: p.character,
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div
        id="detective-notebook-modal"
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-2xl border-4 border-[#5a381e] parchment-texture text-[#2b1f17]"
      >
        {/* Notebook Leather Header */}
        <div className="bg-[#24130b] text-[#f4ecd8] px-6 py-3 border-b-2 border-[#d4af37] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BookOpen className="w-6 h-6 text-[#d4af37]" />
            <div>
              <h3 className="font-deco font-bold text-lg tracking-wider text-[#fff4d1]">
                OFFICIAL DETECTIVE LEDGER
              </h3>
              <p className="text-xs text-[#baa479] font-mono">
                Case #1926-CLUE • Confidential Investigation Notes (Press 'N' to close)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="notebook-close-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#3a2012] hover:bg-[#522e1a] text-[#f4ecd8] border border-[#6b4226] transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Filter Navigation & Legend */}
        <div className="bg-[#ebd9b8] px-6 py-2 border-b border-[#c8b38b] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex space-x-1">
            {(['ALL', 'SUSPECTS', 'WEAPONS', 'ROOMS'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded font-bold transition-colors ${
                  activeTab === tab
                    ? 'bg-[#2b1f17] text-[#f4ecd8]'
                    : 'bg-[#ddc8a2] hover:bg-[#cfb890] text-[#2b1f17]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3 text-[11px] text-[#4b3524]">
            <span className="font-bold">Legend:</span>
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-800" /> Eliminated
            </span>
            <span className="flex items-center gap-1">
              <X className="w-3.5 h-3.5 text-red-800" /> Suspect/Accused
            </span>
            <span className="flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-amber-800" /> Possible
            </span>
          </div>
        </div>

        {/* Notebook Table Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 font-typewriter">
          {/* 1. Suspects Section */}
          {(activeTab === 'ALL' || activeTab === 'SUSPECTS') && (
            <div className="border-2 border-[#b59d74] rounded-lg overflow-hidden bg-[#faf6eb]/80 shadow-sm">
              <div className="bg-[#4a2e18] text-[#f4ecd8] px-4 py-1.5 font-deco font-bold text-sm tracking-wider flex items-center justify-between">
                <span>I. PERSONS OF INTEREST (SUSPECTS)</span>
                <span className="text-xs font-mono opacity-80">6 Suspects</span>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#ede1c7] border-b border-[#b59d74] text-[#422d1b] font-bold">
                    <th className="p-2 pl-3 w-48">Suspect Name</th>
                    {columns.map((col) => (
                      <th key={col.id} className={`p-2 text-center border-l border-[#b59d74] min-w-[85px] ${col.isMe ? 'bg-[#e2d0ab]' : ''}`}>
                        <div className="text-xs font-bold text-[#2b1f17] flex items-center justify-center gap-1">
                          <span className="truncate max-w-[80px]">{col.name}</span>
                          {col.isMe && (
                            <span className="text-[8px] px-1 py-0.2 bg-[#4a2e18] text-[#f4ecd8] rounded font-mono">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-[#6b4e33] font-serif-vintage italic truncate max-w-[80px] mx-auto font-normal">
                          {col.subLabel}
                        </div>
                      </th>
                    ))}
                    <th className="p-2 border-l border-[#b59d74]">Deduction Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ALL_SUSPECTS.map((suspect, idx) => (
                    <tr
                      key={suspect}
                      className={`border-b border-[#c8b38b]/60 ${
                        idx % 2 === 0 ? 'bg-transparent' : 'bg-[#f3ead4]/60'
                      }`}
                    >
                      <td className="p-2 pl-3 font-semibold text-[#1a120c]">{suspect}</td>
                      {columns.map((col) => {
                        const state = marks[suspect]?.[col.id] || 'BLANK';
                        return (
                          <td
                            key={col.id}
                            onClick={() => cycleState(suspect, col.id)}
                            className="p-2 text-center border-l border-[#c8b38b]/60 hover:bg-[#e4d1ab] cursor-pointer transition-colors"
                          >
                            <div className="w-6 h-6 mx-auto border border-[#8a6e4d]/40 rounded bg-[#fffdf7] flex items-center justify-center shadow-inner">
                              {renderCheckIcon(state)}
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-1 border-l border-[#c8b38b]/60">
                        <input
                          type="text"
                          placeholder="clue..."
                          value={customNotes[suspect] || ''}
                          onChange={(e) =>
                            setCustomNotes({ ...customNotes, [suspect]: e.target.value })
                          }
                          className="w-full px-2 py-1 bg-transparent border-b border-dashed border-[#8a6e4d]/40 text-xs focus:outline-none focus:border-[#4a2e18]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 2. Weapons Section */}
          {(activeTab === 'ALL' || activeTab === 'WEAPONS') && (
            <div className="border-2 border-[#b59d74] rounded-lg overflow-hidden bg-[#faf6eb]/80 shadow-sm">
              <div className="bg-[#4a2e18] text-[#f4ecd8] px-4 py-1.5 font-deco font-bold text-sm tracking-wider flex items-center justify-between">
                <span>II. MURDER WEAPONS</span>
                <span className="text-xs font-mono opacity-80">6 Weapons</span>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#ede1c7] border-b border-[#b59d74] text-[#422d1b] font-bold">
                    <th className="p-2 pl-3 w-48">Weapon</th>
                    {columns.map((col) => (
                      <th key={col.id} className={`p-2 text-center border-l border-[#b59d74] min-w-[85px] ${col.isMe ? 'bg-[#e2d0ab]' : ''}`}>
                        <div className="text-xs font-bold text-[#2b1f17] flex items-center justify-center gap-1">
                          <span className="truncate max-w-[80px]">{col.name}</span>
                          {col.isMe && (
                            <span className="text-[8px] px-1 py-0.2 bg-[#4a2e18] text-[#f4ecd8] rounded font-mono">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-[#6b4e33] font-serif-vintage italic truncate max-w-[80px] mx-auto font-normal">
                          {col.subLabel}
                        </div>
                      </th>
                    ))}
                    <th className="p-2 border-l border-[#b59d74]">Deduction Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ALL_WEAPONS.map((weapon, idx) => (
                    <tr
                      key={weapon}
                      className={`border-b border-[#c8b38b]/60 ${
                        idx % 2 === 0 ? 'bg-transparent' : 'bg-[#f3ead4]/60'
                      }`}
                    >
                      <td className="p-2 pl-3 font-semibold text-[#1a120c]">{weapon}</td>
                      {columns.map((col) => {
                        const state = marks[weapon]?.[col.id] || 'BLANK';
                        return (
                          <td
                            key={col.id}
                            onClick={() => cycleState(weapon, col.id)}
                            className="p-2 text-center border-l border-[#c8b38b]/60 hover:bg-[#e4d1ab] cursor-pointer transition-colors"
                          >
                            <div className="w-6 h-6 mx-auto border border-[#8a6e4d]/40 rounded bg-[#fffdf7] flex items-center justify-center shadow-inner">
                              {renderCheckIcon(state)}
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-1 border-l border-[#c8b38b]/60">
                        <input
                          type="text"
                          placeholder="clue..."
                          value={customNotes[weapon] || ''}
                          onChange={(e) =>
                            setCustomNotes({ ...customNotes, [weapon]: e.target.value })
                          }
                          className="w-full px-2 py-1 bg-transparent border-b border-dashed border-[#8a6e4d]/40 text-xs focus:outline-none focus:border-[#4a2e18]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 3. Rooms Section */}
          {(activeTab === 'ALL' || activeTab === 'ROOMS') && (
            <div className="border-2 border-[#b59d74] rounded-lg overflow-hidden bg-[#faf6eb]/80 shadow-sm">
              <div className="bg-[#4a2e18] text-[#f4ecd8] px-4 py-1.5 font-deco font-bold text-sm tracking-wider flex items-center justify-between">
                <span>III. MANSION ROOMS (CRIME SCENE)</span>
                <span className="text-xs font-mono opacity-80">9 Rooms</span>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#ede1c7] border-b border-[#b59d74] text-[#422d1b] font-bold">
                    <th className="p-2 pl-3 w-48">Room</th>
                    {columns.map((col) => (
                      <th key={col.id} className={`p-2 text-center border-l border-[#b59d74] min-w-[85px] ${col.isMe ? 'bg-[#e2d0ab]' : ''}`}>
                        <div className="text-xs font-bold text-[#2b1f17] flex items-center justify-center gap-1">
                          <span className="truncate max-w-[80px]">{col.name}</span>
                          {col.isMe && (
                            <span className="text-[8px] px-1 py-0.2 bg-[#4a2e18] text-[#f4ecd8] rounded font-mono">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-[#6b4e33] font-serif-vintage italic truncate max-w-[80px] mx-auto font-normal">
                          {col.subLabel}
                        </div>
                      </th>
                    ))}
                    <th className="p-2 border-l border-[#b59d74]">Deduction Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ALL_ROOMS.map((room, idx) => (
                    <tr
                      key={room}
                      className={`border-b border-[#c8b38b]/60 ${
                        idx % 2 === 0 ? 'bg-transparent' : 'bg-[#f3ead4]/60'
                      }`}
                    >
                      <td className="p-2 pl-3 font-semibold text-[#1a120c]">{room}</td>
                      {columns.map((col) => {
                        const state = marks[room]?.[col.id] || 'BLANK';
                        return (
                          <td
                            key={col.id}
                            onClick={() => cycleState(room, col.id)}
                            className="p-2 text-center border-l border-[#c8b38b]/60 hover:bg-[#e4d1ab] cursor-pointer transition-colors"
                          >
                            <div className="w-6 h-6 mx-auto border border-[#8a6e4d]/40 rounded bg-[#fffdf7] flex items-center justify-center shadow-inner">
                              {renderCheckIcon(state)}
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-1 border-l border-[#c8b38b]/60">
                        <input
                          type="text"
                          placeholder="clue..."
                          value={customNotes[room] || ''}
                          onChange={(e) =>
                            setCustomNotes({ ...customNotes, [room]: e.target.value })
                          }
                          className="w-full px-2 py-1 bg-transparent border-b border-dashed border-[#8a6e4d]/40 text-xs focus:outline-none focus:border-[#4a2e18]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
