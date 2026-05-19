import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-slate-50">
          <h2 className="font-bold text-lg text-slate-800">{t.instructionsTitle}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <ul className="space-y-3 text-slate-600 text-sm list-disc pl-4">
            {t.instructions.map((instruction, index) => (
              <li key={index} className="leading-relaxed">{instruction}</li>
            ))}
          </ul>
        </div>
        <div className="p-4 border-t bg-slate-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
