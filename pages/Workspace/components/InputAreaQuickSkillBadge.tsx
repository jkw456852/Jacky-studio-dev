import React from 'react';
import { Sparkles, X } from 'lucide-react';
import type { ChatMessage } from '../../../types';

type InputAreaQuickSkillBadgeProps = {
  creationMode: 'agent' | 'image' | 'video';
  activeQuickSkill?: ChatMessage['skillData'] | null;
  onClearQuickSkill?: () => void;
};

export const InputAreaQuickSkillBadge: React.FC<
  InputAreaQuickSkillBadgeProps
> = ({ creationMode, activeQuickSkill, onClearQuickSkill }) => {
  if (!activeQuickSkill || creationMode !== 'agent') {
    return null;
  }

  return (
    <div className="px-3 pb-2">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 pl-2.5 pr-1.5 py-1 text-[11px] font-semibold">
        <Sparkles size={12} strokeWidth={2} />
        <span>{activeQuickSkill.name}</span>
        <button
          onClick={() => onClearQuickSkill?.()}
          className="w-4 h-4 rounded-full hover:bg-blue-100 flex items-center justify-center"
          title="清除当前技能"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
};
