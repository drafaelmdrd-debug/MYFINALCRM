import React, { useState, useEffect } from 'react';
import { DialerMode } from '../types';
import { getDialerMode, setDialerMode } from '../dialerProtocol';
import { PhoneCall } from 'lucide-react';

interface DialerModeSelectorProps {
  id?: string;
  className?: string;
}

export function DialerModeSelector({ id = 'dialer-mode-selector', className = '' }: DialerModeSelectorProps) {
  const [currentMode, setCurrentMode] = useState<DialerMode>(() => getDialerMode());

  useEffect(() => {
    const handleModeChange = (e: Event) => {
      const custom = e as CustomEvent<DialerMode>;
      if (custom.detail) {
        setCurrentMode(custom.detail);
      }
    };
    window.addEventListener('crm-dialer-mode-changed', handleModeChange);
    return () => {
      window.removeEventListener('crm-dialer-mode-changed', handleModeChange);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMode = e.target.value as DialerMode;
    setDialerMode(newMode);
    setCurrentMode(newMode);
  };

  return (
    <div className={`flex items-center gap-2 bg-white border border-[#E4E0D6] rounded-md px-2.5 py-1.5 shadow-2xs ${className}`}>
      <PhoneCall className="w-3.5 h-3.5 text-[#4A7A5E] shrink-0" />
      <span className="text-[11px] font-bold text-[#5E6660] uppercase tracking-wider hidden sm:inline">
        Dialer:
      </span>
      <select
        id={id}
        value={currentMode}
        onChange={handleChange}
        className="text-xs font-semibold text-[#1F2421] bg-transparent outline-none cursor-pointer"
      >
        <option value="desktop">Direct Dialpad (dialpad:)</option>
        <option value="chrome">Browser Link (tel:)</option>
      </select>
    </div>
  );
}
