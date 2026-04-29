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

type AssistantSidebarQuickSkillsProps = {
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
        <button
          onClick={onSendAmazonListing}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:text-gray-900 hover:shadow-sm"
        >
          <Store size={15} strokeWidth={1.8} />
          <span>亚马逊产品套图</span>
        </button>

        <button
          onClick={onSendCnDetail}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
            isCnDetailActive
              ? 'border border-gray-900 bg-gray-900 text-white shadow-sm'
              : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900 hover:shadow-sm'
          }`}
        >
          <Store size={15} strokeWidth={1.8} />
          <span>中文详情页套图</span>
        </button>

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

        <button
          onClick={onSendSocialMedia}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:text-gray-900 hover:shadow-sm"
        >
          <Globe size={15} strokeWidth={1.8} />
          <span>社交媒体</span>
        </button>

        <button
          onClick={onSendBrochure}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:text-gray-900 hover:shadow-sm"
        >
          <FileText size={15} strokeWidth={1.8} />
          <span>营销宣传册</span>
        </button>

        <button
          onClick={onSendStoryboard}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:text-gray-900 hover:shadow-sm"
        >
          <Video size={15} strokeWidth={1.8} />
          <span>分镜故事板</span>
        </button>

        <button
          onClick={onSendClothing}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:text-gray-900 hover:shadow-sm"
        >
          <ImageIcon size={15} strokeWidth={1.8} />
          <span>服装棚拍组图</span>
        </button>

        <button
          onClick={onSendEcommerceOneClick}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:text-gray-900 hover:shadow-sm"
        >
          <Package2 size={15} strokeWidth={1.8} />
          <span>电商一键工作流</span>
        </button>

        <button
          onClick={onSendOneClick}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:text-gray-900 hover:shadow-sm"
        >
          <Compass size={15} strokeWidth={1.8} />
          <span>SKYSPER视觉</span>
        </button>
      </div>
    </motion.div>
  );
};


