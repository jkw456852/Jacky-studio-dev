import React from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, MapPin, X } from 'lucide-react';
import type { InputBlock, Marker } from '../../../types';

type InputAreaMarkerEditPopoverProps = {
  editingMarkerId: string | null;
  editingMarkerLabel: string;
  markers: Marker[];
  inputBlocks: InputBlock[];
  setEditingMarkerId: (id: string | null) => void;
  setEditingMarkerLabel: (label: string) => void;
  onSaveMarkerLabel?: (markerId: string, label: string) => void;
};

export const InputAreaMarkerEditPopover: React.FC<
  InputAreaMarkerEditPopoverProps
> = ({
  editingMarkerId,
  editingMarkerLabel,
  markers,
  inputBlocks,
  setEditingMarkerId,
  setEditingMarkerLabel,
  onSaveMarkerLabel,
}) => {
  if (!editingMarkerId) {
    return null;
  }

  const marker = markers.find((item) => item.id === editingMarkerId);
  const block = inputBlocks.find(
    (item) => item.type === 'file' && item.file?.markerId === editingMarkerId,
  );
  const chipEl = document.getElementById(`marker-chip-${block?.id}`);
  const rect = chipEl?.getBoundingClientRect();

  if (!marker) {
    return null;
  }

  const handleSave = () => {
    if (onSaveMarkerLabel) {
      onSaveMarkerLabel(editingMarkerId, editingMarkerLabel);
    }
    setEditingMarkerId(null);
  };

  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="fixed z-[10000] w-[220px] bg-white rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.12)] border border-gray-100 overflow-hidden flex flex-col"
        style={{
          left: rect ? rect.left + rect.width / 2 : '50%',
          top: rect ? rect.top - 180 : '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Object Marked
          </span>
          <button
            onClick={() => setEditingMarkerId(null)}
            className="p-1 hover:bg-gray-100 rounded-full transition text-gray-400"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 bg-gray-50/80 p-2.5 rounded-2xl border border-gray-100/50">
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm border border-white shrink-0">
              <img src={marker.cropUrl} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-gray-400 font-bold mb-0.5 uppercase">
                AI 分析
              </div>
              <div className="text-[13px] font-bold text-gray-700 truncate">
                {marker.analysis || '识别中...'}
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
              <MapPin size={14} strokeWidth={2} />
            </div>
            <input
              autoFocus
              value={editingMarkerLabel}
              onChange={(event) => setEditingMarkerLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleSave();
                }
              }}
              placeholder="自定义描述..."
              className="w-full h-10 pl-9 pr-10 bg-gray-50/50 hover:bg-white focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-[13px] font-bold text-gray-800 transition-all outline-none"
            />
            <button
              onClick={handleSave}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-blue-500 hover:bg-blue-600 text-white rounded-[10px] flex items-center justify-center shadow-md shadow-blue-500/20 transition-all active:scale-95"
            >
              <Check size={14} strokeWidth={3} />
            </button>
          </div>
        </div>
        <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white" />
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};
