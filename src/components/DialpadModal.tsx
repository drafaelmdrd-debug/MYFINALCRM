import React, { useState, useEffect } from 'react';
import { Lead, VA, Disposition } from '../types';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  X,
  User,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle2,
  Delete,
} from 'lucide-react';
import { VABadge } from './VABadge';

interface DialpadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  initialPhoneNumber?: string;
  openedWithDial?: boolean;
  onSaveAfterCall: (
    leadId: string,
    phoneNumber: string,
    disposition: Disposition,
    notes: string,
    askingPrice: string,
    agent: VA
  ) => void;
}

const DISPOSITIONS: Disposition[] = [
  'VM',
  'Not Interested - 30 Days',
  'Not Interested - 60 Days',
  'Not Interested - 90 Days',
  'Not Ready to Sell - 30 Days',
  'Not Ready to Sell - 60 Days',
  'Not Ready to Sell - 90 Days',
  'WRONG #',
  'ANS MACHINE',
  'RINGING ONLY',
  'DNC',
  'DC/ NOT A WORKING #',
  'Spanish',
  'CANNOT BE DIALED / NOT IN SERVICE',
  'HUNG UP',
  'Interested',
  'Interested - Has Asking Price',
  'CALLBACK',
  'NO ANSWER',
  'LISTED ON MLS',
  'BEEP/FAX TONE',
];

export function DialpadModal({
  isOpen,
  onClose,
  lead,
  initialPhoneNumber,
  openedWithDial = false,
  onSaveAfterCall,
}: DialpadModalProps) {
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [selectedDispo, setSelectedDispo] = useState<Disposition>('NO ANSWER');
  const [agent, setAgent] = useState<VA>('Rain');
  const [notes, setNotes] = useState<string>('');
  const [askingPrice, setAskingPrice] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const targetPhone = initialPhoneNumber || lead?.phoneNumbers[0]?.number || '';
      setPhoneNumber(targetPhone);
      setCallDuration(0);
      setNotes('');
      setAskingPrice(lead?.askingPrice || '');
      if (lead?.assignedVA && ['Rain', 'Jah', 'Jen'].includes(lead.assignedVA)) {
        setAgent(lead.assignedVA);
      }
      if (openedWithDial && targetPhone) {
        setIsCalling(true);
      } else {
        setIsCalling(false);
      }
    }
  }, [isOpen, initialPhoneNumber, lead, openedWithDial]);

  // Call duration timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isCalling) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCalling]);

  if (!isOpen) return null;

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDigit = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleToggleCall = () => {
    if (isCalling) {
      setIsCalling(false);
    } else {
      if (phoneNumber.trim()) {
        setIsCalling(true);
        setCallDuration(0);
      }
    }
  };

  const handleSave = () => {
    if (!lead) return;
    onSaveAfterCall(lead.id, phoneNumber, selectedDispo, notes, askingPrice, agent);
    onClose();
  };

  const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E4E0D6] w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#1F2421] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#B85338] flex items-center justify-center">
              <PhoneCall className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black">Interactive Dialer</h2>
              <p className="text-[10px] text-[#A4AEA7]">
                {lead ? `${lead.ownerName} • ${lead.propertyAddress}` : 'Manual Dialpad'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#A4AEA7] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Phone Number Screen & Status */}
          <div className="bg-[#F8F6F1] border border-[#E4E0D6] rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex-1">
              <span className="text-[10px] font-bold text-[#5E6660] uppercase tracking-wider block">
                Target Number
              </span>
              <div className="font-mono text-xl font-black text-[#1F2421] tracking-tight">
                {phoneNumber || <span className="text-stone-300 font-normal">Enter phone number</span>}
              </div>
            </div>

            {isCalling && (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono font-bold text-xs">{formatTimer(callDuration)}</span>
              </div>
            )}
          </div>

          {/* Keypad & Call Button */}
          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
            {keypad.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleDigit(k)}
                className="py-2.5 rounded-xl bg-white hover:bg-[#F2EFE8] border border-[#E4E0D6] text-base font-bold text-[#1F2421] shadow-2xs transition-all active:scale-95 cursor-pointer font-mono"
              >
                {k}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 max-w-xs mx-auto">
            <button
              type="button"
              onClick={handleBackspace}
              className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
              title="Backspace"
            >
              ⌫
            </button>

            <button
              type="button"
              onClick={handleToggleCall}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                isCalling
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-[#4A7A5E] hover:bg-[#3E654E] text-white'
              }`}
            >
              {isCalling ? (
                <>
                  <PhoneOff className="w-4 h-4" />
                  <span>End Call</span>
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  <span>Start Call</span>
                </>
              )}
            </button>
          </div>

          {/* Disposition & VA Logger Section */}
          <div className="border-t border-[#E4E0D6] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#5E6660] uppercase tracking-wider">
                Call Disposition
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#5E6660] font-semibold">Agent:</span>
                {(['Rain', 'Jah', 'Jen'] as VA[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAgent(v)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      agent === v
                        ? 'bg-[#1F2421] text-white'
                        : 'bg-stone-100 text-[#5E6660] hover:bg-stone-200'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1 bg-[#F8F6F1] rounded-lg border border-[#E4E0D6]">
              {DISPOSITIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDispo(d)}
                  className={`py-1.5 px-2 rounded text-[10px] font-bold text-center truncate transition-colors cursor-pointer ${
                    selectedDispo === d
                      ? 'bg-[#B85338] text-white shadow-2xs'
                      : 'bg-white text-[#1F2421] hover:bg-white/80 border border-[#E4E0D6]'
                  }`}
                  title={d}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-[#5E6660] uppercase tracking-wider">
                Call Notes
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log notes about seller interest, property condition, offer response..."
                rows={2}
                className="w-full text-xs bg-[#F8F6F1] border border-[#E4E0D6] rounded-lg p-2.5 outline-none focus:bg-white focus:border-[#B85338]"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <span className="text-[11px] font-bold text-[#5E6660] uppercase tracking-wider">
                  Asking Price
                </span>
                <input
                  type="text"
                  value={askingPrice}
                  onChange={(e) => setAskingPrice(e.target.value)}
                  placeholder="e.g. $175,000"
                  className="w-full text-xs font-mono font-semibold bg-[#F8F6F1] border border-[#E4E0D6] rounded-lg px-3 py-1.5 outline-none focus:bg-white focus:border-[#B85338]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#F8F6F1] border-t border-[#E4E0D6] px-5 py-3 flex items-center justify-between">
          <span className="text-[11px] text-[#5E6660]">
            Dispo: <strong className="text-[#B85338]">{selectedDispo}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-[#5E6660] hover:text-[#1F2421] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!lead}
              className="px-4 py-1.5 bg-[#4A7A5E] hover:bg-[#3E654E] text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              Save & Log Call
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
