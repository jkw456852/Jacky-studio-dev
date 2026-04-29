
import React, { useState, useEffect } from 'react';
import { X, Save, Key, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { safeLocalStorageSetItem } from '../../utils/safe-storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [polloKey, setPolloKey] = useState('');
  const [yunwuKey, setYunwuKey] = useState('');
  const [yunwuGroup, setYunwuGroup] = useState('');
  const [showYunwuKey, setShowYunwuKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const storedPollo = localStorage.getItem('pollo_api_key');
    if (storedPollo) setPolloKey(storedPollo);

    const storedYunwu = localStorage.getItem('yunwu_api_key');
    if (storedYunwu) setYunwuKey(storedYunwu);

    const storedGroup = localStorage.getItem('yunwu_group');
    if (storedGroup) setYunwuGroup(storedGroup);
  }, [isOpen]);

  const handleSave = () => {
    safeLocalStorageSetItem('pollo_api_key', polloKey.trim());
    safeLocalStorageSetItem('yunwu_api_key', yunwuKey.trim());
    safeLocalStorageSetItem('yunwu_group', yunwuGroup.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    setTimeout(onClose, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-[480px] bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-700/50 rounded-lg">
              <Key size={16} className="text-white" />
            </div>
            <span className="text-sm font-bold text-white">设置 (Settings)</span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pollo.ai API Key (Wan 2.5)</label>
              <a href="https://pollo.ai/dashboard/api-keys" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors">
                <span>获取 Key</span>
                <ExternalLink size={10} />
              </a>
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-500 font-mono text-xs">key-</span>
              </div>
              <input
                type="password"
                autoComplete="off"
                className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
                placeholder="粘贴您的 Pollo API Key..."
                value={polloKey}
                onChange={(e) => setPolloKey(e.target.value)}
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              用于激活 <strong>Wan 2.1 / Wan 2.5</strong> 视频生成模型。密钥仅保存在您的浏览器本地存储中。
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">云雾 API Key (Yunwu.ai)</label>
              <a href="https://yunwu.ai/" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors">
                <span>获取 Key</span>
                <ExternalLink size={10} />
              </a>
            </div>

            <div className="relative group">
              <div className="absolute top-3 left-3 pointer-events-none">
                <span className="text-slate-500 font-mono text-xs">sk-</span>
              </div>
              <textarea
                autoComplete="off"
                className={`w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all font-mono min-h-[120px] custom-scrollbar ${!showYunwuKey ? 'blur-sm select-none' : ''}`}
                placeholder="按行输入您的云雾 API Key (一行一个)..."
                value={yunwuKey}
                onChange={(e) => setYunwuKey(e.target.value)}
              />
              <button
                onClick={() => setShowYunwuKey(!showYunwuKey)}
                className="absolute top-3 right-3 p-1.5 text-slate-500 hover:text-cyan-400 transition-colors bg-white/5 rounded-lg border border-white/10"
                title={showYunwuKey ? "隐藏密码" : "显示密码"}
              >
                {showYunwuKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              用于激活 <strong>Gemini 3 Pro / Nnaobanana2</strong> 及视频模型。支持多 Key 轮询（一行一个）。密钥仅保存在本地。
            </p>

            <div className="space-y-2 pt-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">API 分组 (Optional Group)</label>
              <input
                type="text"
                className="w-full bg-black/30 border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
                placeholder="例如: premium, vip (默认为自动)"
                value={yunwuGroup}
                onChange={(e) => setYunwuGroup(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-[#121214] flex justify-end">
          <button
            onClick={handleSave}
            className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${isSaved ? 'bg-green-500 text-white' : 'bg-white text-black hover:bg-cyan-400'}`}
          >
            {isSaved ? '已保存' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
};
