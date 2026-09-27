import React from 'react';
import { AccusationResultPayload } from '../../types/cluedo';
import { CardView } from './CardView';
import { getCardByName } from '../../engine/assets';
import {
  AlertOctagon,
  Award,
  CheckCircle2,
  XCircle,
  FileText,
  ShieldCheck,
  Eye,
  BookOpen,
} from 'lucide-react';

interface EnvelopeInspectionModalProps {
  payload: AccusationResultPayload | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenNotebook?: () => void;
}

export const EnvelopeInspectionModal: React.FC<EnvelopeInspectionModalProps> = ({
  payload,
  isOpen,
  onClose,
  onOpenNotebook,
}) => {
  if (!isOpen || !payload) return null;

  const { isCorrect, accusation, envelope, accuserName } = payload;
  const hasEnvelope = Boolean(envelope && envelope.suspect && envelope.weapon && envelope.room);

  const suspectCard = getCardByName(hasEnvelope ? envelope!.suspect : accusation.suspect);
  const weaponCard = getCardByName(hasEnvelope ? envelope!.weapon : accusation.weapon);
  const roomCard = getCardByName(hasEnvelope ? envelope!.room : accusation.room);

  const suspectMatch = hasEnvelope ? accusation.suspect === envelope!.suspect : false;
  const weaponMatch = hasEnvelope ? accusation.weapon === envelope!.weapon : false;
  const roomMatch = hasEnvelope ? accusation.room === envelope!.room : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in overflow-y-auto">
      <div
        id="envelope-inspection-modal"
        className={`relative w-full max-w-2xl rounded-2xl bg-[#20130d] border-2 ${
          isCorrect ? 'border-[#d4af37]' : 'border-[#9b111e]'
        } p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.95)] text-[#f4e4bc] flex flex-col space-y-5`}
      >
        {/* Header Ribbon */}
        <div className="flex items-center space-x-3.5 border-b border-[#d4af37]/30 pb-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl flex-shrink-0 ${
              isCorrect
                ? 'bg-[#d4af37]/20 border-2 border-[#d4af37] text-[#d4af37]'
                : 'bg-[#9b111e]/20 border-2 border-[#9b111e] text-red-400'
            }`}
          >
            {isCorrect ? <Award className="w-7 h-7" /> : <AlertOctagon className="w-7 h-7" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-deco tracking-widest text-[#d4af37] uppercase bg-[#140b08] px-2 py-0.5 rounded border border-[#d4af37]/30">
                Official Case Archive
              </span>
              <span
                className={`text-[10px] font-deco font-bold tracking-wider uppercase px-2 py-0.5 rounded ${
                  isCorrect
                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40'
                    : 'bg-red-950/80 text-red-300 border border-red-500/40'
                }`}
              >
                {isCorrect ? 'Accusation Confirmed' : 'Accusation Refuted'}
              </span>
            </div>
            <h2 className="font-deco font-black text-xl sm:text-2xl text-[#f4e4bc] mt-1 uppercase tracking-wider">
              {isCorrect
                ? 'CASE SOLVED BY ACCUSATION!'
                : hasEnvelope
                ? 'CONFIDENTIAL ENVELOPE INSPECTION'
                : `OFFICIAL ACCUSATION BY ${accuserName.toUpperCase()}`}
            </h2>
          </div>
        </div>

        {/* Narrative Banner */}
        <div
          className={`p-4 rounded-xl border flex items-start space-x-3 text-xs leading-relaxed font-serif-vintage ${
            isCorrect
              ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-200'
              : 'bg-[#150a08] border-[#9b111e]/80 text-red-200'
          }`}
        >
          {isCorrect ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5 not-italic" />
          ) : (
            <Eye className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 not-italic" />
          )}
          <div className="space-y-1">
            <strong className="text-[#f4e4bc] font-deco font-bold uppercase tracking-wider block">
              {isCorrect
                ? 'VERDICT: ABSOLUTE ACCURACY'
                : hasEnvelope
                ? 'OFFICIAL CLUEDO RULE RULING:'
                : `INCORRECT ACCUSATION DECLARED:`}
            </strong>
            {isCorrect ? (
              <p>
                Detective <strong className="text-[#d4af37] not-italic">{accuserName}</strong>, every
                single piece of the indictment matches the secret murder envelope perfectly!
              </p>
            ) : hasEnvelope ? (
              <p>
                As required by the rules of Cluedo, you have secretly opened and inspected the murder
                envelope. Because your accusation did not match all three cards, you are{' '}
                <strong className="text-red-400 font-bold not-italic">
                  permanently eliminated from taking turns, moving, or making suggestions
                </strong>
                . However, you{' '}
                <strong className="text-[#d4af37] font-bold not-italic">
                  remain in the manor to disprove other detectives' suggestions
                </strong>{' '}
                from your hand when asked!
              </p>
            ) : (
              <p>
                Detective <strong className="text-[#d4af37] not-italic">{accuserName}</strong> made an
                official final accusation with the cards below, but was{' '}
                <strong className="text-red-400 font-bold not-italic">refuted</strong> by the confidential
                envelope! They are eliminated from taking turns but will continue disproving suggestions.
              </p>
            )}
          </div>
        </div>

        {/* Accused / Envelope Cards Presentation */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-deco font-bold uppercase tracking-widest text-[#d4af37] flex items-center space-x-1.5">
              <FileText className="w-4 h-4" />
              <span>
                {hasEnvelope
                  ? 'THE TRUE MURDER ENVELOPE CONTENTS'
                  : 'ACCUSED EVIDENCE CARDS (FOR YOUR DETECTIVE NOTES)'}
              </span>
            </span>
            <span className="text-[11px] font-serif-vintage italic text-[#baa479]">
              {hasEnvelope ? 'Secretly unsealed for your eyes only' : 'Publicly declared accusation'}
            </span>
          </div>

          {/* 3 Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 justify-items-center bg-[#150a08] p-4 rounded-xl border border-[#d4af37]/20">
            {/* Suspect Card */}
            <div className="flex flex-col items-center space-y-1.5 w-full">
              <div className="relative">
                <CardView card={suspectCard} size="sm" />
                {hasEnvelope && (
                  <div
                    className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg border ${
                      suspectMatch
                        ? 'bg-emerald-600 border-white text-white'
                        : 'bg-red-600 border-white text-white'
                    }`}
                    title={suspectMatch ? 'Matched accusation' : 'Mismatched accusation'}
                  >
                    {suspectMatch ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-mono uppercase text-[#baa479] text-center">
                Accused: <strong className="text-[#f4e4bc]">{accusation.suspect}</strong>
              </span>
            </div>

            {/* Weapon Card */}
            <div className="flex flex-col items-center space-y-1.5 w-full">
              <div className="relative">
                <CardView card={weaponCard} size="sm" />
                {hasEnvelope && (
                  <div
                    className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg border ${
                      weaponMatch
                        ? 'bg-emerald-600 border-white text-white'
                        : 'bg-red-600 border-white text-white'
                    }`}
                    title={weaponMatch ? 'Matched accusation' : 'Mismatched accusation'}
                  >
                    {weaponMatch ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-mono uppercase text-[#baa479] text-center">
                Accused: <strong className="text-[#f4e4bc]">{accusation.weapon}</strong>
              </span>
            </div>

            {/* Room Card */}
            <div className="flex flex-col items-center space-y-1.5 w-full">
              <div className="relative">
                <CardView card={roomCard} size="sm" />
                {hasEnvelope && (
                  <div
                    className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg border ${
                      roomMatch
                        ? 'bg-emerald-600 border-white text-white'
                        : 'bg-red-600 border-white text-white'
                    }`}
                    title={roomMatch ? 'Matched accusation' : 'Mismatched accusation'}
                  >
                    {roomMatch ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-mono uppercase text-[#baa479] text-center">
                Accused: <strong className="text-[#f4e4bc]">{accusation.room}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {onOpenNotebook && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNotebook();
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded bg-[#150a08] hover:bg-[#2e1810] text-[#baa479] hover:text-[#f4e4bc] border border-[#d4af37]/30 text-xs font-deco uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Record In Detective Ledger</span>
            </button>
          )}

          <button
            id="close-envelope-inspection-btn"
            type="button"
            onClick={onClose}
            className={`w-full sm:w-auto px-6 py-2.5 rounded text-white font-deco font-bold text-xs uppercase tracking-widest shadow-xl flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              isCorrect
                ? 'bg-[#d4af37] hover:bg-[#b8952e] text-[#1a0f0d] shadow-[#d4af37]/20'
                : 'bg-[#9b111e] hover:bg-red-700 shadow-red-900/40'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isCorrect
                ? 'Claim Victory'
                : hasEnvelope
                ? 'Acknowledge & Continue Spectating'
                : 'Noted & Dismiss'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
