'use client';

import { useEffect, useState } from 'react';
import { Icons } from '@/app/components/ui/Icons';
import AIAdvisor from './AIAdvisor';

export default function AdvisorToggle({ name, city }) {
  const [open, setOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState('');
  const [autoSendKey, setAutoSendKey] = useState(0);

  useEffect(() => {
    const handleOpenAdvisor = (event) => {
      const msg = event?.detail?.message || 'Lihat skor keuangan saya';
      setInitialMessage(msg);
      setAutoSendKey((k) => k + 1);
      setOpen(true);
    };

    window.addEventListener('sakupuan:open-advisor', handleOpenAdvisor);
    return () => window.removeEventListener('sakupuan:open-advisor', handleOpenAdvisor);
  }, []);

  return (
    <div className="fixed right-4 bottom-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <AIAdvisor
          name={name}
          city={city}
          onClose={() => setOpen(false)}
          initialMessage={initialMessage}
          autoSendKey={autoSendKey}
        />
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Tutup Puan AI' : 'Buka Puan AI'}
        className="flex items-center gap-2 bg-[#1F5932] hover:bg-[#174628] text-white font-semibold text-sm pl-3.5 pr-4 py-3 rounded-full shadow-floating transition-transform active:scale-95"
      >
        <Icons.Bot className="w-5 h-5" />
        {open ? (
          'Tutup'
        ) : (
          <span className="text-left leading-tight">
            <span className="block">Puan AI</span>
          </span>
        )}
      </button>
    </div>
  );
}

