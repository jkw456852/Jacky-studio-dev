import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { useAgentStore } from '../../../stores/agent.store';
import { useInputAreaFileHandling } from '../controllers/useInputAreaFileHandling';
import { getActiveQuickSkillPreference } from '../../../services/runtime-assets/preferences';
import { InputAreaBottomToolbar } from './InputAreaBottomToolbar';
import { InputAreaEditor } from './InputAreaEditor';
import { InputAreaMarkerEditPopover } from './InputAreaMarkerEditPopover';
import { InputAreaMediaUploadPanel } from './InputAreaMediaUploadPanel';
import { ImageModel, Marker, VideoModel } from '../../../types';
import type { ChatMessage } from '../../../types';
import type { AgentType } from '../../../types/agent.types';

const isSora2Model = (model?: string | null) => /sora\s*2/i.test(String(model || ''));

export type InputAreaComposerProps = {
  creationMode: 'agent' | 'image' | 'video';
  setCreationMode: (mode: 'agent' | 'image' | 'video') => void;
  handleSend: (
    overridePrompt?: string,
    overrideAttachments?: File[],
    overrideWeb?: boolean,
    skillData?: ChatMessage['skillData'],
  ) => Promise<void>;
  handleModeSwitch: (mode: 'thinking' | 'fast') => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
};

export type InputAreaInputUiProps = {
  selectedChipId: string | null;
  setSelectedChipId: (id: string | null) => void;
  hoveredChipId: string | null;
  setHoveredChipId: (id: string | null) => void;
  showModeSelector: boolean;
  setShowModeSelector: (value: boolean) => void;
  showRatioPicker: boolean;
  setShowRatioPicker: (value: boolean) => void;
  showModelPicker: boolean;
  setShowModelPicker: (value: boolean) => void;
  isInputFocused: boolean;
  setIsInputFocused: (value: boolean) => void;
  isDragOver: boolean;
  setIsDragOver: (value: boolean) => void;
  isVideoPanelHovered: boolean;
  setIsVideoPanelHovered: (value: boolean) => void;
  showVideoSettingsDropdown: boolean;
  setShowVideoSettingsDropdown: (value: boolean) => void;
};

export type InputAreaModelPreferencesProps = {
  showModelPreference: boolean;
  setShowModelPreference: (value: boolean) => void;
  modelPreferenceTab: 'image' | 'video' | '3d';
  setModelPreferenceTab: (tab: 'image' | 'video' | '3d') => void;
  autoModelSelect: boolean;
  setAutoModelSelect: (value: boolean) => void;
  preferredImageModel: ImageModel;
  setPreferredImageModel: (value: ImageModel) => void;
  preferredImageProviderId: string | null;
  setPreferredImageProviderId: (value: string | null) => void;
  preferredVideoModel: VideoModel;
  setPreferredVideoModel: (value: VideoModel) => void;
  preferredVideoProviderId: string | null;
  setPreferredVideoProviderId: (value: string | null) => void;
  preferred3DModel: string;
  setPreferred3DModel: (value: string) => void;
};

export type InputAreaBrowserAgentProps = {
  chatEnabled: boolean;
  setChatEnabled: (value: boolean) => void;
  currentStepTitle: string | null;
  selectedElementLabel: string;
  plannerModelLabel: string;
  suggestedGoal: string;
  hasPendingPlan: boolean;
  isPlanning: boolean;
  isRunning: boolean;
  isStarting: boolean;
  isContinuing: boolean;
  isRefreshing: boolean;
  error: string | null;
  onRefresh: () => void;
  onCancel: () => void;
};

interface InputAreaProps {
  composer: InputAreaComposerProps;
  inputUi: InputAreaInputUiProps;
  modelPreferences: InputAreaModelPreferencesProps;
  browserAgent?: InputAreaBrowserAgentProps;
  markers: Marker[];
  onSaveMarkerLabel?: (markerId: string, label: string) => void;
}

export const InputArea: React.FC<InputAreaProps> = ({
  composer: { creationMode, setCreationMode, handleSend, handleModeSwitch, fileInputRef },
  inputUi: {
    selectedChipId,
    setSelectedChipId,
    hoveredChipId,
    setHoveredChipId,
    showModeSelector,
    setShowModeSelector,
    showRatioPicker,
    setShowRatioPicker,
    showModelPicker,
    setShowModelPicker,
    isInputFocused,
    setIsInputFocused,
    isDragOver,
    setIsDragOver,
    isVideoPanelHovered,
    setIsVideoPanelHovered,
    showVideoSettingsDropdown,
    setShowVideoSettingsDropdown,
  },
  modelPreferences: {
    showModelPreference,
    setShowModelPreference,
    modelPreferenceTab,
    setModelPreferenceTab,
    autoModelSelect,
    setAutoModelSelect,
    preferredImageModel,
    setPreferredImageModel,
    preferredImageProviderId,
    setPreferredImageProviderId,
    preferredVideoModel,
    setPreferredVideoModel,
    preferredVideoProviderId,
    setPreferredVideoProviderId,
    preferred3DModel,
    setPreferred3DModel,
  },
  browserAgent,
  markers,
  onSaveMarkerLabel,
}) => {
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingMarkerLabel, setEditingMarkerLabel] = useState('');
  const [isAllInputSelected, setIsAllInputSelected] = useState(false);

  const composer = useAgentStore((state) => state.composer);
  const generation = useAgentStore((state) => state.generation);
  const inputBlocks = composer.inputBlocks;
  const videoGenRatio = generation.videoGenRatio;
  const videoGenDuration = generation.videoGenDuration;
  const videoGenModel = generation.videoGenModel;
  const videoGenMode = generation.videoGenMode;
  const videoStartFrame = generation.videoStartFrame;
  const videoEndFrame = generation.videoEndFrame;
  const videoMultiRefs = generation.videoMultiRefs;
  const modelMode = useAgentStore((state) => state.modelMode);
  const webEnabled = useAgentStore((state) => state.webEnabled);
  const imageGenUploads = generation.imageGenUploads;
  const isPickingFromCanvas = generation.isPickingFromCanvas;
  const pendingAttachments = composer.pendingAttachments;
  const agentSelectionMode = useAgentStore((state) => state.agentSelectionMode);
  const pinnedAgentId = useAgentStore((state) => state.pinnedAgentId);
  const translatePromptToEnglish = useAgentStore((state) => state.translatePromptToEnglish);
  const enforceChineseTextInImage = useAgentStore((state) => state.enforceChineseTextInImage);
  const requiredChineseCopy = useAgentStore((state) => state.requiredChineseCopy);
  const imageGenRatio = generation.imageGenRatio;
  const imageGenRes = generation.imageGenRes;
  const imageGenCount = generation.imageGenCount;
  const sendSkill = getActiveQuickSkillPreference() || undefined;

  const {
    setInputBlocks,
    removeInputBlock,
    insertInputFile,
    updateInputBlock,
    setActiveBlockId,
    setSelectionIndex,
    setVideoGenRatio,
    setVideoGenDuration,
    setVideoGenModel,
    setVideoGenMode,
    setVideoStartFrame,
    setVideoEndFrame,
    setVideoMultiRefs,
    setWebEnabled,
    setAgentSelectionMode,
    setPinnedAgentId,
    setIsAgentMode,
    setImageGenUploads,
    setIsPickingFromCanvas,
    confirmPendingAttachments,
    removePendingAttachment,
    setTranslatePromptToEnglish,
    setEnforceChineseTextInImage,
    setRequiredChineseCopy,
    setImageGenRatio,
    setImageGenRes,
    setImageGenCount,
  } = useAgentStore((state) => state.actions);

  const isSoraVideoModel = isSora2Model(videoGenModel);

  const {
    getObjectUrl,
    selectLatestCanvasChip,
    commitPendingAttachments,
    handlePickedFiles,
    handleEditorPaste,
    clearAllInputBlocks,
  } = useInputAreaFileHandling({
    creationMode,
    inputBlocks,
    imageGenUploads,
    videoStartFrame,
    videoEndFrame,
    videoMultiRefs,
    pendingAttachments,
    selectedChipId,
    insertInputFile,
    setImageGenUploads,
    confirmPendingAttachments,
    setSelectedChipId,
    setInputBlocks,
    updateInputBlock,
    setActiveBlockId,
    onResetInputSelectionState: () => setIsAllInputSelected(false),
  });

  return (
    <div className="px-3 py-2 z-20 flex-shrink-0">
      <div
        className={`bg-white rounded-2xl border border-gray-200 shadow-sm transition-all duration-200 relative group focus-within:shadow-md focus-within:border-gray-300 flex flex-col overflow-visible ${
          isDragOver ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/30' : ''
        }`}
        onMouseEnter={() => setIsVideoPanelHovered(true)}
        onMouseLeave={() => setIsVideoPanelHovered(false)}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragOver(false);
          if (event.dataTransfer.files.length > 0) {
            handlePickedFiles(Array.from(event.dataTransfer.files));
          }
        }}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-30 rounded-[20px] bg-blue-50/80 border-2 border-dashed border-blue-400 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <ImageIcon size={24} className="text-blue-500" />
              <span className="text-sm font-medium text-blue-600">将文件拖拽至此处添加至对话</span>
            </div>
          </div>
        )}

        <InputAreaMediaUploadPanel
          creationMode={creationMode}
          isVideoPanelHovered={isVideoPanelHovered}
          imageGenUploads={imageGenUploads}
          isPickingFromCanvas={isPickingFromCanvas}
          videoStartFrame={videoStartFrame}
          videoEndFrame={videoEndFrame}
          videoMultiRefs={videoMultiRefs}
          videoGenMode={videoGenMode}
          isSoraVideoModel={isSoraVideoModel}
          getObjectUrl={getObjectUrl}
          handlePickedFiles={handlePickedFiles}
          setImageGenUploads={setImageGenUploads}
          setIsPickingFromCanvas={setIsPickingFromCanvas}
          setVideoStartFrame={setVideoStartFrame}
          setVideoEndFrame={setVideoEndFrame}
          setVideoMultiRefs={setVideoMultiRefs}
        />

        <InputAreaEditor
          creationMode={creationMode}
          agentPlaceholder={
            creationMode === 'agent' && browserAgent
              ? browserAgent.suggestedGoal
              : undefined
          }
          inputBlocks={inputBlocks}
          markers={markers}
          pendingAttachments={pendingAttachments}
          selectedChipId={selectedChipId}
          setSelectedChipId={setSelectedChipId}
          hoveredChipId={hoveredChipId}
          setHoveredChipId={setHoveredChipId}
          isInputFocused={isInputFocused}
          setIsInputFocused={setIsInputFocused}
          isAllInputSelected={isAllInputSelected}
          setIsAllInputSelected={setIsAllInputSelected}
          getObjectUrl={getObjectUrl}
          handleEditorPaste={handleEditorPaste}
          commitPendingAttachments={commitPendingAttachments}
          selectLatestCanvasChip={selectLatestCanvasChip}
          clearAllInputBlocks={clearAllInputBlocks}
          updateInputBlock={updateInputBlock}
          setActiveBlockId={setActiveBlockId}
          setSelectionIndex={setSelectionIndex}
          setInputBlocks={setInputBlocks}
          handleSend={handleSend}
          sendSkill={sendSkill}
          removeInputBlock={removeInputBlock}
          removePendingAttachment={removePendingAttachment}
          setEditingMarkerId={setEditingMarkerId}
          setEditingMarkerLabel={setEditingMarkerLabel}
        />

        <InputAreaBottomToolbar
          creationMode={creationMode}
          setCreationMode={setCreationMode}
          handleSend={handleSend}
          handleModeSwitch={handleModeSwitch}
          fileInputRef={fileInputRef}
          showModeSelector={showModeSelector}
          setShowModeSelector={setShowModeSelector}
          showRatioPicker={showRatioPicker}
          setShowRatioPicker={setShowRatioPicker}
          showModelPicker={showModelPicker}
          setShowModelPicker={setShowModelPicker}
          showVideoSettingsDropdown={showVideoSettingsDropdown}
          setShowVideoSettingsDropdown={setShowVideoSettingsDropdown}
          showModelPreference={showModelPreference}
          setShowModelPreference={setShowModelPreference}
          modelPreferenceTab={modelPreferenceTab}
          setModelPreferenceTab={setModelPreferenceTab}
          autoModelSelect={autoModelSelect}
          setAutoModelSelect={setAutoModelSelect}
          preferredImageModel={preferredImageModel}
          setPreferredImageModel={setPreferredImageModel}
          preferredImageProviderId={preferredImageProviderId}
          setPreferredImageProviderId={setPreferredImageProviderId}
          preferredVideoModel={preferredVideoModel}
          setPreferredVideoModel={setPreferredVideoModel}
          preferredVideoProviderId={preferredVideoProviderId}
          setPreferredVideoProviderId={setPreferredVideoProviderId}
          preferred3DModel={preferred3DModel}
          setPreferred3DModel={setPreferred3DModel}
          imageGenRatio={imageGenRatio}
          setImageGenRatio={setImageGenRatio}
          imageGenRes={imageGenRes}
          setImageGenRes={(value) => setImageGenRes(value as '1K' | '2K' | '4K')}
          imageGenCount={imageGenCount}
          setImageGenCount={setImageGenCount}
          imageGenUploads={imageGenUploads}
          videoGenRatio={videoGenRatio}
          setVideoGenRatio={setVideoGenRatio}
          videoGenDuration={videoGenDuration}
          setVideoGenDuration={(value) => setVideoGenDuration(value as typeof videoGenDuration)}
          videoGenModel={videoGenModel}
          setVideoGenModel={setVideoGenModel}
          videoGenMode={videoGenMode}
          setVideoGenMode={setVideoGenMode}
          modelMode={modelMode}
          webEnabled={webEnabled}
          setWebEnabled={setWebEnabled}
          agentSelectionMode={agentSelectionMode}
          setAgentSelectionMode={setAgentSelectionMode}
          pinnedAgentId={pinnedAgentId}
          setPinnedAgentId={setPinnedAgentId as (value: AgentType) => void}
          setIsAgentMode={setIsAgentMode}
          translatePromptToEnglish={translatePromptToEnglish}
          setTranslatePromptToEnglish={setTranslatePromptToEnglish}
          enforceChineseTextInImage={enforceChineseTextInImage}
          setEnforceChineseTextInImage={setEnforceChineseTextInImage}
          requiredChineseCopy={requiredChineseCopy}
          setRequiredChineseCopy={setRequiredChineseCopy}
          inputBlocks={inputBlocks}
          browserAgent={browserAgent}
          sendSkill={sendSkill}
          isSoraVideoModel={isSoraVideoModel}
          handlePickedFiles={handlePickedFiles}
        />

        <InputAreaMarkerEditPopover
          editingMarkerId={editingMarkerId}
          editingMarkerLabel={editingMarkerLabel}
          markers={markers}
          inputBlocks={inputBlocks}
          setEditingMarkerId={setEditingMarkerId}
          setEditingMarkerLabel={setEditingMarkerLabel}
          onSaveMarkerLabel={onSaveMarkerLabel}
        />
      </div>
    </div>
  );
};
