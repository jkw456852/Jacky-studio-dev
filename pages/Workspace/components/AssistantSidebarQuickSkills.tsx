import React from 'react';
import { motion } from 'framer-motion';
import {
  Compass,
  FileText,
  Globe,
  Image as ImageIcon,
  Package2,
  Store,
  Video,
} from 'lucide-react';
import type {
  CnDetailPromptVersion,
  CnDetailRatioMode,
  CnDetailTextMode,
} from '../../../types';

type QuickSkillEntry = {
  id: string;
  pluginId: string;
  label: string;
  iconName: string;
  kind:
    | 'amazon'
    | 'cn-detail'
    | 'social'
    | 'brochure'
    | 'storyboard'
    | 'clothing'
    | 'ecommerce'
    | 'oneclick';
};

type AssistantSidebarQuickSkillsProps = {
  quickSkillPluginEnabled: boolean;
  quickSkillPluginPinned: boolean;
  quickSkillEntries: QuickSkillEntry[];
  isCnDetailActive: boolean;
  cnDetailPromptVersion: CnDetailPromptVersion;
  cnDetailTextMode: CnDetailTextMode;
  cnDetailRatioMode: CnDetailRatioMode;
  onSendAmazonListing: () => void;
  onSendCnDetail: () => void;
  onSelectCnDetailPromptVersion: (value: CnDetailPromptVersion) => void;
  onSelectCnDetailTextMode: (value: CnDetailTextMode) => void;
  onSelectCnDetailRatioMode: (value: CnDetailRatioMode) => void;
  onSendSocialMedia: () => void;
  onSendBrochure: () => void;
  onSendStoryboard: () => void;
  onSendClothing: () => void;
  onSendEcommerceOneClick: () => void;
  onSendOneClick: () => void;
};

export const AssistantSidebarQuickSkills: React.FC<AssistantSidebarQuickSkillsProps> = ({
  quickSkillPluginEnabled,
  quickSkillPluginPinned,
  quickSkillEntries,
  isCnDetailActive,
  cnDetailPromptVersion,
  cnDetailTextMode,
  cnDetailRatioMode,
  onSendAmazonListing,
  onSendCnDetail,
  onSelectCnDetailPromptVersion,
  onSelectCnDetailTextMode,
  onSelectCnDetailRatioMode,
  onSendSocialMedia,
  onSendBrochure,
  onSendStoryboard,
  onSendClothing,
  onSendEcommerceOneClick,
  onSendOneClick,
}) => {
  if (!quickSkillPluginEnabled) {
    return null;
  }

  const orderedEntries = [...quickSkillEntries].sort((left, right) => {
    if (!quickSkillPluginPinned) return 0;
    const leftPinned = left.kind === 'amazon' || left.kind === 'cn-detail';
    const rightPinned = right.kind === 'amazon' || right.kind === 'cn-detail';
    if (leftPinned === rightPinned) return 0;
    return leftPinned ? -1 : 1;
  });

  const renderSkillButton = (entry: QuickSkillEntry) => {
    const iconMap = {
      amazon: Store,
      'cn-detail': Store,
      social: Globe,
      brochure: FileText,
      storyboard: Video,
      clothing: ImageIcon,
      ecommerce: Package2,
      oneclick: Compass,
    } as const;
    const Icon = iconMap[entry.kind];

    const onClickMap = {
      amazon: onSendAmazonListing,
      'cn-detail': onSendCnDetail,
      social: onSendSocialMedia,
      brochure: onSendBrochure,
      storyboard: onSendStoryboard,
      clothing: onSendClothing,
      ecommerce: onSendEcommerceOneClick,
      oneclick: onSendOneClick,
    } as const;

    if (entry.kind === 'cn-detail') {
      return (
        <button
          key={entry.id}
          onClick={onClickMap[entry.kind]}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
            isCnDetailActive
              ? 'border border-gray-900 bg-gray-900 text-white shadow-sm'
              : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900 hover:shadow-sm'
          }`}
        >
          <Icon size={15} strokeWidth={1.8} />
          <span>{entry.label}</span>
        </button>
      );
    }

    return (
      <button
        key={entry.id}
        onClick={onClickMap[entry.kind]}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:text-gray-900 hover:shadow-sm"
      >
        <Icon size={15} strokeWidth={1.8} />
        <span>{entry.label}</span>
      </button>
    );
  };

  const primaryEntries = orderedEntries.filter(
    (entry) => entry.kind === 'amazon' || entry.kind === 'cn-detail',
  );
  const secondaryEntries = orderedEntries.filter(
    (entry) => entry.kind !== 'amazon' && entry.kind !== 'cn-detail',
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="mb-6 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-[10px] font-bold tracking-wide text-white shadow-sm">
          JK
        </div>
        <span className="text-base font-bold tracking-tight text-gray-900">Jacky-Studio</span>
      </div>

      <h3 className="mb-2 text-xl font-bold leading-tight text-gray-900">选择快捷技能</h3>
      <p className="mb-6 text-sm leading-relaxed text-gray-400">
        选择一个技能，快速启动结构化工作流。
      </p>

      <div className="flex flex-wrap gap-2.5">
        {primaryEntries.map(renderSkillButton)}

        <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-0.5">
          <button
            onClick={() => onSelectCnDetailPromptVersion('original')}
            className={`rounded-full px-2.5 py-1.5 text-xs transition ${cnDetailPromptVersion === 'original' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}
          >
            原版
          </button>
          <button
            onClick={() => onSelectCnDetailPromptVersion('new')}
            className={`rounded-full px-2.5 py-1.5 text-xs transition ${cnDetailPromptVersion === 'new' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}
          >
            新版
          </button>
        </div>

        <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-0.5">
          <button
            onClick={() => onSelectCnDetailTextMode('auto')}
            className={`rounded-full px-2.5 py-1.5 text-xs transition ${cnDetailTextMode === 'auto' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}
          >
            文案自适应
          </button>
          <button
            onClick={() => onSelectCnDetailTextMode('withText')}
            className={`rounded-full px-2.5 py-1.5 text-xs transition ${cnDetailTextMode === 'withText' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}
          >
            强制带文案
          </button>
          <button
            onClick={() => onSelectCnDetailTextMode('noText')}
            className={`rounded-full px-2.5 py-1.5 text-xs transition ${cnDetailTextMode === 'noText' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}
          >
            无文案
          </button>
        </div>

        <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-0.5">
          <button
            onClick={() => onSelectCnDetailRatioMode('adaptive')}
            className={`rounded-full px-2.5 py-1.5 text-xs transition ${cnDetailRatioMode === 'adaptive' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}
          >
            比例自适应
          </button>
          <button
            onClick={() => onSelectCnDetailRatioMode('fixed')}
            className={`rounded-full px-2.5 py-1.5 text-xs transition ${cnDetailRatioMode === 'fixed' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}
          >
            固定 3:4
          </button>
        </div>
        {secondaryEntries.map(renderSkillButton)}
      </div>
    </motion.div>
  );
};


