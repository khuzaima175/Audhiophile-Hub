import React from 'react';
import { XIcon, MaximizeIcon } from './Icon';

interface TableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const TableModal: React.FC<TableModalProps> = ({ isOpen, onClose, title = "Comparison Table", children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 md:p-8 animate-in fade-in duration-200"
      style={{ touchAction: 'none' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-[#0A0A0A] w-full max-w-6xl rounded-2xl border border-audio-border shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ touchAction: 'auto' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-audio-border bg-[#050505] rounded-t-2xl">
          <div className="flex items-center gap-2 text-audio-accent">
            <MaximizeIcon />
            <span className="font-bold text-sm uppercase tracking-wide">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Content - Scrollable Area */}
        <div
          className="flex-1 table-scroll-container !overflow-auto p-4 md:p-6 custom-scrollbar bg-[#080808]"
        >
          <div className="min-w-max">
            {children}
          </div>
        </div>

        {/* Mobile Hint Footer */}
        <div className="md:hidden py-2 px-4 bg-[#050505] border-t border-audio-border text-center rounded-b-2xl">
          <p className="text-[10px] text-gray-500">Swipe → to view more columns</p>
        </div>
      </div>
    </div>
  );
};

export default TableModal;

