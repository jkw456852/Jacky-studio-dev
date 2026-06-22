import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Key, X, Check, Eye, EyeOff, Loader2,
  Sliders, Info, Globe, Banana, Zap,
  Bot, Search, RefreshCw, ChevronDown, ChevronUp, GripVertical,
  FileText, Image as ImageIcon, Video, Plus, Box, ArrowLeft
} from 'lucide-react';
import { SettingsCard } from '../components/Settings/SettingsCard';
import { SettingsControl, SettingsToggle, SettingsInput, SettingsSelect } from '../components/Settings/SettingsControl';
import { useAuthSession } from '../hooks/useAuthSession';
import { useImageHostStore } from '../stores/imageHost.store';
import Sidebar from '../components/Sidebar';
import {
    syncLocalAccountSecretsToAccount,
} from '../services/account-secrets';
import type {
    SearchDefaultsConfig,
    SearchProviderConfig,
} from '../services/account-secrets-shared';
import {
    getSearchProviderCatalogItem,
    getSearchProvidersByGroup,
    type SearchProviderCatalogItem,
} from '../services/search-provider-catalog';
import {
    ApiProviderConfig,
    ImageModelPostPathConfig,
    ModelInfo,
    buildMappedModelStorageEntry,
    getResolvedImageModelPostPathConfig,
    getMappedModelConfigs,
    getModelDisplayLabel,
    getDefaultProviders,
    loadProviderSettings,
    normalizeMappedModelId,
    parseMappedModelStorageEntry,
    refreshAllProviderModels,
    saveProviderSettings,
} from '../services/provider-settings';
import {
    loadSearchSettings,
    saveSearchSettings,
} from '../services/search-settings';

type ApiProvider = 'gemini' | 'yunwu' | 'plato' | 'custom';
type MappingCategory = 'script' | 'image' | 'video';
type SettingsTab = 'api' | 'mapping' | 'search' | 'hosting' | 'advanced' | 'about';
const AUTO_IMAGE_OPTION_ID = 'Auto';

const DEFAULT_MODEL_WHITELIST = [
    // 图片模型
    'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview', 'gemini-2.5-flash-image',
    'doubao-seedream-5-0-260128', 'gpt-image-2', 'gpt-image-1.5-all', 'flux-pro-max',
    // 语言模型
    'gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-3-flash-preview',
    'gemini-3-pro-preview-11-2025', 'gemini-3-pro-preview-thinking',
    'gemini-2.5-pro', 'gemini-2.5-pro-thinking',
    'claude-sonnet-4-6', 'claude-opus-4-6', 'claude-opus-4-6-thinking',
    'claude-haiku-4-5-20251001-thinking', 'claude-haiku-4-5-20251001',
    'deepseek-v3.2', 'deepseek-v3.2-thinking', /* cspell:disable-line */
    'gpt-5.3-codex', 'gpt-5.3-codex-high', 'grok-4.2',
    // 视频模型
    'grok-video-3-15s', 'grok-video-3-10s', 'grok-video-3',
    'doubao-seedance-1-5-pro-251215', /* cspell:disable-line */
    'sora-2-all', 'sora-2-pro-all', 'wan2.6-i2v', 'veo3.1-4k', 'veo3.1-c'
];

const PROVIDER_ICONS: { id: ModelInfo['brand'] | string; name: string; icon: string }[] = [
    { id: 'deepseek', name: 'DeepSeek', icon: '/icons/deepseek.svg' }, /* cspell:disable-line */
    { id: 'openai', name: 'OpenAI', icon: '/icons/openai.svg' },
    { id: 'anthropic', name: 'Anthropic', icon: '/icons/anthropic.svg' },
    { id: 'volcengine', name: '火山引擎', icon: '/icons/volc.svg' }, /* cspell:disable-line */
    { id: 'bailian', name: '阿里百炼', icon: '/icons/alibailian.svg' }, /* cspell:disable-line */
    { id: 'chatglm', name: '智谱清言', icon: '/icons/chatglm.svg' }, /* cspell:disable-line */
    { id: 'wenxin', name: '百度文心', icon: '/icons/wenxin.svg' }, /* cspell:disable-line */
    { id: 'minimax', name: '海螺 MiniMax', icon: '/icons/minimax.svg' },
    { id: 'gemini', name: 'Google Node', icon: '/icons/gemini.svg' },
    { id: 'imagen', name: 'Imagen Node', icon: '/icons/imagen.svg' }, /* cspell:disable-line */
    { id: 'flux', name: 'Flux AI Node', icon: '/icons/flux.svg' },
    { id: 'ideogram', name: 'Ideogram Node', icon: '/icons/ideogram.svg' },
    { id: 'fal', name: 'Fal AI Node', icon: '/icons/fal.svg' },
    { id: 'hailuo', name: 'Hailuo Node', icon: '/icons/hailuo.svg' }, /* cspell:disable-line */
    { id: 'replicate', name: 'Replicate Node', icon: '/icons/replicate.svg' },
    { id: 'midjourney', name: 'Midjourney Node', icon: '/icons/midjourney.svg' },
];

const ModelCard = React.memo(({
    model,
    isSelected,
    onToggle,
    providerName
}: {
    model: ModelInfo;
    isSelected: boolean;
    onToggle: () => void;
    providerName: string;
}) => (
    <div
        onClick={onToggle}
        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${isSelected
            ? 'bg-gray-50/50 border-black shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'
            }`}
    >
        <div className="flex items-center gap-4">
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected
                ? 'bg-black border-black' : 'border-gray-200'
                }`}>
                {isSelected && <Check size={12} className="text-white" strokeWidth={4} />}
            </div>
            <div>
                <div className="text-sm font-bold text-gray-800 tracking-tight truncate max-w-[180px]">{model.id}</div>
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{model.brand || 'Other'} Node</div>
            </div>
        </div>
        <div className="text-[10px] font-bold px-2.5 py-1 bg-gray-50 text-gray-400 rounded-md group-hover:bg-gray-100 group-hover:text-black transition-colors">
            {providerName}
        </div>
    </div>
));

ModelCard.displayName = 'ModelCard';

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<SettingsTab>('api');
    const [providers, setProviders] = useState<ApiProviderConfig[]>(getDefaultProviders());
    const [activeProviderId, setActiveProviderId] = useState('yunwu');
    const searchSettingsBootstrap = useMemo(() => loadSearchSettings(), []);
    const [searchProviders, setSearchProviders] = useState<SearchProviderConfig[]>(searchSettingsBootstrap.providers);
    const [activeSearchProviderId, setActiveSearchProviderId] = useState(searchSettingsBootstrap.activeProviderId);
    const [selectedSearchProviderId, setSelectedSearchProviderId] = useState(searchSettingsBootstrap.activeProviderId);
    const [searchDefaults, setSearchDefaults] = useState<SearchDefaultsConfig>(searchSettingsBootstrap.defaults);

    const [replicateKey, setReplicateKey] = useState('');
    const [klingKey, setKlingKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');

    // Service Mapping State
    const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [brandFilter, setBrandFilter] = useState<string>('all');

    const [selectedScriptModels, setSelectedScriptModels] = useState<string[]>([]);
    const [selectedImageModels, setSelectedImageModels] = useState<string[]>([]);
    const [selectedVideoModels, setSelectedVideoModels] = useState<string[]>([]);
    const [imageModelPostPaths, setImageModelPostPaths] = useState<Record<string, ImageModelPostPathConfig>>({});
    const [visualOrchestratorModel, setVisualOrchestratorModel] = useState('auto');
    const [browserAgentModel, setBrowserAgentModel] = useState('auto');
    const [visualOrchestratorMaxReferenceImages, setVisualOrchestratorMaxReferenceImages] = useState(0);
    const [visualOrchestratorMaxInlineImageBytesMb, setVisualOrchestratorMaxInlineImageBytesMb] = useState(48);
    const [manualScriptModel, setManualScriptModel] = useState('');
    const [manualImageModel, setManualImageModel] = useState('');
    const [manualVideoModel, setManualVideoModel] = useState('');
    const [manualProviderId, setManualProviderId] = useState('yunwu');
    const [showImgBBKeys, setShowImgBBKeys] = useState(false);
    const [showCustomHostKeys, setShowCustomHostKeys] = useState(false);
    const [showSearchProviderKeys, setShowSearchProviderKeys] = useState(false);
    const [accountSecretsStatus, setAccountSecretsStatus] = useState<'idle' | 'syncing' | 'restoring' | 'success' | 'error'>('idle');
    const [accountSecretsMessage, setAccountSecretsMessage] = useState('');

    const [expandedCategory, setExpandedCategory] = useState<string | null>('image');
    const [visibleCount, setVisibleCount] = useState(60);

    // Advanced Settings
    const [visualContinuity, setVisualContinuity] = useState(true);
    const [systemModeration, setSystemModeration] = useState(false);
    const [autoSave, setAutoSave] = useState(true);
    const [concurrentCount, setConcurrentCount] = useState(1);

    // Editing state
    const [editingProvider, setEditingProvider] = useState<ApiProviderConfig | null>(null);
    const [draggingSelectedModel, setDraggingSelectedModel] = useState<string | null>(null);
    const [dragOverSelectedModel, setDragOverSelectedModel] = useState<{
        entry: string;
        position: 'before' | 'after';
    } | null>(null);
    const [expandedImageRouteEntries, setExpandedImageRouteEntries] = useState<string[]>([]);

    const normalizeImageSelection = (models: string[]): string[] => {
        if (!Array.isArray(models) || models.length === 0) return [AUTO_IMAGE_OPTION_ID];
        const withoutAuto = models.filter((entry) => entry !== AUTO_IMAGE_OPTION_ID);
        if (withoutAuto.length === 0) return [AUTO_IMAGE_OPTION_ID];
        return Array.from(new Set(withoutAuto));
    };

    const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
        if (fromIndex === toIndex) return items;
        const next = [...items];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
    };

    // Image Host Store (Reactive Hook)
    const imageHost = useImageHostStore();
    const { session } = useAuthSession();

    const applyLoadedSettings = (loaded: ReturnType<typeof loadProviderSettings>) => {
        setProviders(loaded.providers);
        setActiveProviderId(loaded.activeProviderId);
        setReplicateKey(loaded.replicateKey);
        setKlingKey(loaded.klingKey);
        setSelectedScriptModels(loaded.selectedScriptModels);
        setSelectedImageModels(normalizeImageSelection(loaded.selectedImageModels));
        setSelectedVideoModels(loaded.selectedVideoModels);
        setImageModelPostPaths(loaded.imageModelPostPaths || {});
        setVisualOrchestratorModel(loaded.visualOrchestratorModel || 'auto');
        setBrowserAgentModel(loaded.browserAgentModel || 'auto');
        setVisualOrchestratorMaxReferenceImages(loaded.visualOrchestratorMaxReferenceImages ?? 0);
        setVisualOrchestratorMaxInlineImageBytesMb(loaded.visualOrchestratorMaxInlineImageBytesMb ?? 48);
        setManualProviderId(loaded.activeProviderId || 'yunwu');
        setVisualContinuity(loaded.visualContinuity);
        setSystemModeration(loaded.systemModeration);
        setAutoSave(loaded.autoSave);
        setConcurrentCount(loaded.concurrentCount);

        const loadedSearchSettings = loadSearchSettings();
        setSearchProviders(loadedSearchSettings.providers);
        setActiveSearchProviderId(loadedSearchSettings.activeProviderId);
        setSelectedSearchProviderId(loadedSearchSettings.activeProviderId);
        setSearchDefaults(loadedSearchSettings.defaults);
    };

    useEffect(() => {
        applyLoadedSettings(loadProviderSettings());
        setSaveStatus('idle');
    }, []);

    const categoryMeta: Array<{
        id: MappingCategory;
        label: string;
        hint: string;
        multi: boolean;
    }> = [
        { id: 'script', label: '文本与推理模型', hint: '用于补全、分析、问答与多模态理解。', multi: true },
        { id: 'image', label: '图片生成模型', hint: '用于电商生图、改图和工作流出图。', multi: true },
        { id: 'video', label: '视频生成模型', hint: '用于视频工作流和动画生成。', multi: true },
    ];

    const visualOrchestratorModelOptions = useMemo(() => {
        const mappedScriptModels = getMappedModelConfigs('script', providers);
        const discoveredScriptModels = availableModels
            .filter((model) => model.category === 'script')
            .map((model) => {
                const entry = buildMappedModelStorageEntry(
                    model.providerId || activeProviderId,
                    model.id,
                );
                const provider = providers.find((item) => item.id === (model.providerId || activeProviderId));
                return {
                    entry,
                    label: provider?.name
                        ? `${getModelDisplayLabel(model.id)} @ ${provider.name}`
                        : getModelDisplayLabel(model.id),
                };
            });

        const merged = new Map<string, { entry: string; label: string }>();
        merged.set('auto', {
            entry: 'auto',
            label: `自动（跟随 ${mappedScriptModels[0]?.displayLabel || '默认文本模型'}）`,
        });

        mappedScriptModels.forEach((item) => {
            if (!item.raw) return;
            merged.set(item.raw, {
                entry: item.raw,
                label: item.displayLabel,
            });
        });

        discoveredScriptModels.forEach((item) => {
            if (!item.entry) return;
            if (!merged.has(item.entry)) {
                merged.set(item.entry, item);
            }
        });

        return Array.from(merged.values());
    }, [activeProviderId, availableModels, providers]);

    const browserAgentModelOptions = useMemo(() => visualOrchestratorModelOptions, [visualOrchestratorModelOptions]);

    useEffect(() => {
        if (activeTab === 'mapping') {
            void handleRefreshModels();
        }
    }, [activeTab, providers]);

    const handleRefreshModels = async () => {
        setIsLoadingModels(true);
        try {
            const formattedModels = await refreshAllProviderModels(providers);
            setAvailableModels(formattedModels);

            const autoSelect = (
                cat: MappingCategory,
                currentSelected: string[],
                setCurrent: React.Dispatch<React.SetStateAction<string[]>>,
            ) => {
                if (cat === 'image' || currentSelected.length > 0) return;
                const newMatches = formattedModels
                    .filter((m) => m.category === cat && DEFAULT_MODEL_WHITELIST.includes(m.id))
                    .map((m) => buildMappedModelStorageEntry(m.providerId || activeProviderId, m.id))
                    .filter(Boolean);

                if (newMatches.length > 0) {
                    setCurrent(Array.from(new Set(newMatches)));
                }
            };

            autoSelect('script', selectedScriptModels, setSelectedScriptModels);
            autoSelect('video', selectedVideoModels, setSelectedVideoModels);
        } finally {
            setIsLoadingModels(false);
        }
    };

    const syncAccountSecretsToAccount = async (accessToken: string) => {
        setAccountSecretsStatus('syncing');
        setAccountSecretsMessage('');

        try {
            const remoteSnapshot = await syncLocalAccountSecretsToAccount({
                accessToken,
            });
            setAccountSecretsStatus('success');
            setAccountSecretsMessage(`已保存系统设置，并按本地当前状态同步 ${remoteSnapshot.providers.length} 个供应商配置、图床与三方密钥到账号。`);
            return remoteSnapshot;
        } catch (error) {
            const message = error instanceof Error ? error.message : '敏感配置同步失败，请稍后重试';
            setAccountSecretsStatus('error');
            setAccountSecretsMessage(message);
            throw error;
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setAccountSecretsMessage('');

        try {
            await new Promise((resolve) => setTimeout(resolve, 600));
            saveProviderSettings({
                providers,
                activeProviderId,
                replicateKey,
                klingKey,
                selectedScriptModels,
                selectedImageModels: normalizeImageSelection(selectedImageModels),
                selectedVideoModels,
                imageModelPostPaths,
                visualOrchestratorModel,
                browserAgentModel,
                visualOrchestratorMaxReferenceImages,
                visualOrchestratorMaxInlineImageBytesMb,
                visualContinuity,
                systemModeration,
                autoSave,
                concurrentCount,
            });
            saveSearchSettings({
                providers: searchProviders,
                activeProviderId: activeSearchProviderId,
                defaults: searchDefaults,
            });

            const accessToken = String(session?.access_token || '').trim();
            if (accessToken) {
                try {
                    await syncAccountSecretsToAccount(accessToken);
                } catch {
                    // 消息已由同步流程设置；不阻断本地保存成功态。
                }
            } else {
                setAccountSecretsStatus('success');
                setAccountSecretsMessage('已保存系统设置；当前未登录，敏感配置仅保存在本机。登录后再次保存即可同步到账号。');
            }

            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            setSaveStatus('idle');
            setAccountSecretsStatus('error');
            setAccountSecretsMessage(error instanceof Error ? error.message : '保存失败，请稍后重试');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteProvider = (id: string) => {
        if (!window.confirm('确定要删除这个供应商吗？')) return;
        setProviders((prev) => {
            const nextProviders = prev.filter((p) => p.id !== id);
            const fallbackProviderId = nextProviders.find((provider) => provider.id === 'yunwu')?.id
                || nextProviders[0]?.id
                || '';

            if (activeProviderId === id) {
                setActiveProviderId(fallbackProviderId);
            }

            if (manualProviderId === id) {
                setManualProviderId(fallbackProviderId);
            }

            const removeMappedEntriesForProvider = (entries: string[], category: MappingCategory) => (
                entries.filter((entry) => parseMappedModelStorageEntry(category, entry).providerId !== id)
            );

            setSelectedScriptModels((prevEntries) => removeMappedEntriesForProvider(prevEntries, 'script'));
            setSelectedImageModels((prevEntries) => normalizeImageSelection(removeMappedEntriesForProvider(prevEntries, 'image')));
            setSelectedVideoModels((prevEntries) => removeMappedEntriesForProvider(prevEntries, 'video'));

            return nextProviders;
        });
    };

    const activeSearchProvider = searchProviders.find((provider) => provider.id === selectedSearchProviderId)
        || searchProviders.find((provider) => provider.id === activeSearchProviderId)
        || searchProviders[0];

    const persistSearchSettings = (next: {
        providers?: SearchProviderConfig[];
        activeProviderId?: string;
        defaults?: SearchDefaultsConfig;
        selectedProviderId?: string;
    }) => {
        const normalized = saveSearchSettings({
            providers: next.providers || searchProviders,
            activeProviderId: next.activeProviderId || activeSearchProviderId,
            defaults: next.defaults || searchDefaults,
        });

        setSearchProviders(normalized.providers);
        setActiveSearchProviderId(normalized.activeProviderId);
        setSearchDefaults(normalized.defaults);
        setSelectedSearchProviderId(
            next.selectedProviderId
            || (normalized.providers.some((provider) => provider.id === selectedSearchProviderId)
                ? selectedSearchProviderId
                : normalized.activeProviderId),
        );

        return normalized;
    };

    const updateSearchProvider = (providerId: string, updater: (provider: SearchProviderConfig) => SearchProviderConfig) => {
        const nextProviders = searchProviders.map((provider) => (
            provider.id === providerId ? updater(provider) : provider
        ));
        persistSearchSettings({
            providers: nextProviders,
            selectedProviderId: providerId,
        });
    };

    const updateSearchDefaults = <K extends keyof SearchDefaultsConfig>(key: K, value: SearchDefaultsConfig[K]) => {
        persistSearchSettings({
            defaults: {
                ...searchDefaults,
                [key]: value,
            },
        });
    };

    const getSearchProviderMeta = (
        provider: SearchProviderConfig | undefined,
        catalog: SearchProviderCatalogItem | null,
    ) => {
        if (!provider || !catalog) {
            return {
                endpointLabel: '未选择搜索服务商',
                endpointHint: '请先选择一个网络搜索服务商',
                docsHref: 'https://www.microsoft.com/bing',
                docsLabel: '打开官网',
                apiKeyPlaceholder: '请输入 API Key',
                baseUrlPlaceholder: 'https://your-search-host.example.com',
                baseUrlLabel: '搜索入口地址',
                baseUrlDescription: '留空使用默认地址。',
                baseUrlRequired: false,
                supportsBaseUrl: true,
            };
        }

        const apiKeyField = catalog.fields.find((field: SearchProviderCatalogItem['fields'][number]) => field.key === 'apiKey');
        const baseUrlField = catalog.fields.find((field: SearchProviderCatalogItem['fields'][number]) => field.key === 'baseUrl');

        return {
            endpointLabel: catalog.label,
            endpointHint: catalog.description,
            docsHref: catalog.id === 'bing' ? catalog.websiteUrl : catalog.docsUrl,
            docsLabel: catalog.id === 'bing' ? '打开官网' : '打开文档',
            apiKeyPlaceholder: apiKeyField?.placeholder || '请输入 API Key',
            baseUrlPlaceholder: baseUrlField?.placeholder || 'https://your-search-host.example.com',
            baseUrlLabel: baseUrlField?.label || '搜索入口地址',
            baseUrlDescription: baseUrlField
                ? (baseUrlField.required ? '请输入完整地址。' : '留空使用默认地址。')
                : '留空使用默认地址。',
            baseUrlRequired: Boolean(baseUrlField?.required),
            supportsBaseUrl: Boolean(baseUrlField),
        };
    };

    const getSearchProviderBadge = (provider: SearchProviderConfig) => {
        const catalog = getSearchProviderCatalogItem(provider.catalogId || provider.id);
        return catalog?.badges?.[0] || '搜索服务';
    };

    const getSearchProviderIcon = (provider: SearchProviderConfig) => {
        if (provider.providerType === 'bing') return <Search size={18} />;
        if (provider.providerType === 'searxng' || provider.providerType === 'custom') return <Globe size={18} />;
        if (provider.providerType === 'tavily') return <Zap size={18} />;
        if (provider.providerType === 'exa') return <Bot size={18} />;
        return <Sliders size={18} />;
    };

    const searchProviderGroups = getSearchProvidersByGroup().map((group) => ({
        ...group,
        items: group.items.filter((catalog: SearchProviderCatalogItem) => searchProviders.some((provider) => provider.id === catalog.id || provider.catalogId === catalog.id)),
    })).filter((group: { id: string; label: string; items: SearchProviderCatalogItem[] }) => group.items.length > 0);
    const activeSearchCatalog = getSearchProviderCatalogItem(activeSearchProvider?.catalogId || activeSearchProvider?.id);
    const searchProviderMeta = getSearchProviderMeta(activeSearchProvider, activeSearchCatalog);
    const blockedDomainsText = searchDefaults.blockedDomains.join('\n');

    const getSelectedModels = (category: MappingCategory): string[] => {
        if (category === 'script') return selectedScriptModels;
        if (category === 'image') return selectedImageModels;
        return selectedVideoModels;
    };

    const getModelEntryMeta = (category: MappingCategory, entry: string) => {
        if (category === 'image' && entry === AUTO_IMAGE_OPTION_ID) {
            return {
                raw: entry,
                modelId: AUTO_IMAGE_OPTION_ID,
                providerId: null,
                providerName: '自动',
                displayLabel: 'Auto',
            };
        }

        const parsed = parseMappedModelStorageEntry(category, entry);
        const provider = providers.find((item) => item.id === parsed.providerId);
        return {
            raw: entry,
            modelId: parsed.modelId || entry,
            providerId: parsed.providerId,
            providerName: provider?.name || parsed.providerId || '默认供应商',
            displayLabel: getModelDisplayLabel(parsed.modelId || entry),
        };
    };

    const getImageModelPostPathKey = (entry: string): string | null => {
        if (entry === AUTO_IMAGE_OPTION_ID) return null;
        const parsed = parseMappedModelStorageEntry('image', entry);
        if (!parsed.modelId) return null;
        return buildMappedModelStorageEntry(parsed.providerId, parsed.modelId);
    };

    const getImageModelPostPathConfig = (entry: string): ImageModelPostPathConfig => {
        const key = getImageModelPostPathKey(entry);
        if (!key) {
            return {
                withReferences: '',
                withoutReferences: '',
            };
        }
        return imageModelPostPaths[key] || {
            withReferences: '',
            withoutReferences: '',
        };
    };

    const updateImageModelPostPath = (
        entry: string,
        field: keyof ImageModelPostPathConfig,
        value: string,
    ) => {
        const key = getImageModelPostPathKey(entry);
        if (!key) return;
        setImageModelPostPaths((prev) => {
            const current = prev[key] || { withReferences: '', withoutReferences: '' };
            const nextValue = value;
            const nextConfig = {
                ...current,
                [field]: nextValue,
            };
            if (!nextConfig.withReferences.trim() && !nextConfig.withoutReferences.trim()) {
                const next = { ...prev };
                delete next[key];
                return next;
            }
            return {
                ...prev,
                [key]: nextConfig,
            };
        });
    };

    const toggleImageRouteEntryExpanded = (entry: string) => {
        setExpandedImageRouteEntries((prev) =>
            prev.includes(entry)
                ? prev.filter((item) => item !== entry)
                : [...prev, entry],
        );
    };

    const isModelSelected = (category: MappingCategory, model: ModelInfo): boolean => {
        const expected = buildMappedModelStorageEntry(model.providerId || activeProviderId, model.id);
        return getSelectedModels(category).some((entry) => {
            if (entry === expected) return true;
            const parsed = parseMappedModelStorageEntry(category, entry);
            return parsed.modelId === normalizeMappedModelId(category, model.id) && (parsed.providerId || '') === (model.providerId || '');
        });
    };

    const toggleModel = (category: MappingCategory, model: string | ModelInfo, providerId?: string) => {
        const entry = typeof model === 'string'
            ? buildMappedModelStorageEntry(providerId || manualProviderId, model)
            : buildMappedModelStorageEntry(model.providerId || providerId || activeProviderId, model.id);
        if (!entry) return;

        if (category === 'script') {
            setSelectedScriptModels((prev) => prev.includes(entry) ? prev.filter((id) => id !== entry) : [...prev, entry]);
        } else if (category === 'image') {
            if (typeof model === 'string' && model === AUTO_IMAGE_OPTION_ID) {
                setSelectedImageModels([AUTO_IMAGE_OPTION_ID]);
            } else {
                setSelectedImageModels((prev) => {
                    const base = prev.filter((id) => id !== AUTO_IMAGE_OPTION_ID);
                    return base.includes(entry)
                        ? base.filter((id) => id !== entry)
                        : [...base, entry];
                });
            }
        } else {
            setSelectedVideoModels((prev) => prev.includes(entry) ? prev.filter((id) => id !== entry) : [...prev, entry]);
        }
    };

    const removeSelectedModel = (category: MappingCategory, entry: string) => {
        if (category === 'script') {
            setSelectedScriptModels((prev) => prev.filter((id) => id !== entry));
            return;
        }
        if (category === 'image') {
            const next = selectedImageModels.filter((id) => id !== entry);
            setSelectedImageModels(normalizeImageSelection(next));
            return;
        }
        setSelectedVideoModels((prev) => prev.filter((id) => id !== entry));
    };

    const reorderSelectedModels = (category: MappingCategory, fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;

        if (category === 'script') {
            setSelectedScriptModels((prev) => moveItem(prev, fromIndex, toIndex));
            return;
        }
        if (category === 'image') {
            setSelectedImageModels((prev) => normalizeImageSelection(moveItem(prev, fromIndex, toIndex)));
            return;
        }
        setSelectedVideoModels((prev) => moveItem(prev, fromIndex, toIndex));
    };

    const getDropPosition = (event: React.DragEvent<HTMLDivElement>): 'before' | 'after' => {
        const rect = event.currentTarget.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        return event.clientY < midpoint ? 'before' : 'after';
    };

    const clearSelectedModelDragState = () => {
        setDraggingSelectedModel(null);
        setDragOverSelectedModel(null);
    };

    const addManualModel = (category: MappingCategory) => {
        const rawValue =
            category === 'script'
                ? manualScriptModel
                : category === 'image'
                    ? manualImageModel
                    : manualVideoModel;
        const normalized = rawValue.trim();
        if (!normalized) return;
        toggleModel(category, normalized, manualProviderId);

        if (category === 'script') setManualScriptModel('');
        else if (category === 'image') setManualImageModel('');
        else setManualVideoModel('');
    };

    const filteredModels = useMemo(() => {
        return availableModels.filter((m) => {
            if (m.id.toLowerCase().includes('embedding')) return false;
            const matchesCategory = m.category === expandedCategory;
            const matchesSearch = m.id.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesBrand = brandFilter === 'all' || m.brand?.toLowerCase() === brandFilter.toLowerCase();
            return matchesCategory && matchesSearch && matchesBrand;
        });
    }, [availableModels, searchQuery, brandFilter, expandedCategory]);

    const visibleModels = useMemo(() => filteredModels.slice(0, visibleCount), [filteredModels, visibleCount]);
    const availableBrands = useMemo(() => {
        const brands = availableModels
            .filter((model) => model.category === expandedCategory)
            .map((model) => model.brand)
            .filter((brand): brand is NonNullable<ModelInfo['brand']> => Boolean(brand));
        return Array.from(new Set(brands)).sort((a, b) => a.localeCompare(b));
    }, [availableModels, expandedCategory]);

    useEffect(() => {
        setVisibleCount(60);
    }, [searchQuery, brandFilter, availableModels, expandedCategory]);

    const tabs: { id: SettingsTab; label: string; icon: any }[] = [
        { id: 'api', label: '服务商配置', icon: Key },
        { id: 'mapping', label: '模型映射', icon: Bot },
        { id: 'search', label: '网络搜索', icon: Search },
        { id: 'hosting', label: '图床设置', icon: ImageIcon },
        { id: 'advanced', label: '高级设置', icon: Sliders },
        { id: 'about', label: '关于', icon: Info },
    ];

    const activeMappingCategory = (expandedCategory && categoryMeta.some((category) => category.id === expandedCategory)
        ? expandedCategory
        : 'image') as 'script' | 'image' | 'video';
    const selectedModelsForExpanded = getSelectedModels(activeMappingCategory);


    return (
        <div className="flex min-h-screen bg-[#f8f9fa] selection:bg-black/5 transition-colors duration-500">
            <Sidebar />
            
            <div className="flex-1 flex flex-col pb-16 lg:pb-0">
                <header className="px-6 lg:px-12 py-8 lg:mt-4 flex items-center justify-between sticky top-0 z-30 bg-[#f8f9fa]/80 backdrop-blur-xl">
                    <div className="flex items-center gap-4 lg:gap-8 ml-2">
                        <button 
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-black border border-gray-200 transition-all active:scale-95"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="flex flex-col">
                            <h3 className="text-2xl lg:text-3xl font-display font-bold text-foreground tracking-tight flex items-center gap-4">
                                设置中心
                                {activeTab && (
                                    <span className="hidden sm:inline-block text-[11px] lg:text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-primary/20">
                                        {tabs.find(t => t.id === activeTab)?.label}
                                    </span>
                                )}
                            </h3>
                            <p className="hidden lg:block text-[11px] lg:text-xs text-muted-foreground/60 uppercase tracking-[0.2em] mt-1.5 font-semibold">Jacky-Studio Infrastructure</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`px-7 lg:px-10 py-2.5 lg:py-3 rounded-full text-sm lg:text-[15px] font-bold text-white shadow-xl shadow-black/10 transition-all duration-300 active:scale-95 hover:-translate-y-0.5 flex items-center gap-2 lg:gap-3 ${saveStatus === 'success'
                                ? 'bg-green-500 hover:bg-green-600'
                                : 'bg-black hover:bg-gray-800'
                                }`}
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : saveStatus === 'success' ? <Check size={18} /> : <div className="p-0.5 bg-white/20 rounded-md"><RefreshCw size={16} /></div>}
                            <span className="hidden xs:inline">{saveStatus === 'success' ? '配置已入库' : '保存系统设置'}</span>
                            <span className="xs:hidden">{saveStatus === 'success' ? 'OK' : '保存'}</span>
                        </button>
                        {accountSecretsMessage && (
                            <div className={`max-w-[320px] text-right text-xs leading-5 ${accountSecretsStatus === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
                                {accountSecretsMessage}
                            </div>
                        )}
                    </div>
                </header>

                <div className="flex flex-1 flex-col lg:flex-row max-w-[1800px] w-full mx-auto px-6 lg:px-10">
                    {/* Inner Sidebar */}
                    <div className="lg:w-56 w-full py-10 flex lg:flex-col overflow-x-auto lg:overflow-y-auto gap-0.5 no-scrollbar lg:border-r lg:border-gray-200/50 pr-8">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const active = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-4 px-6 py-3.5 rounded-xl transition-all duration-300 group shrink-0 lg:shrink ${active
                                        ? 'bg-gray-100/80 text-black shadow-sm'
                                        : 'text-gray-450 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg transition-colors ${active ? 'bg-black/5 text-black' : 'text-gray-400 group-hover:text-gray-700'}`}>
                                        <Icon size={20} />
                                    </div>
                                    <span className={`text-[15px] tracking-tight ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
                                    {active && (
                                        <motion.div 
                                            layoutId="activeTabDot"
                                            className="ml-auto w-1.5 h-4 rounded-full bg-black"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Main Content */}
                    <main className="flex-1 p-6 lg:p-14 space-y-12 no-scrollbar pb-24 lg:pb-10">
                        {activeTab === 'api' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-xl font-display font-bold text-gray-900">API 供应商</h4>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Infrastructure Management</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newP: ApiProviderConfig = {
                                                id: `custom_${Date.now()}`,
                                                name: '新服务商',
                                                baseUrl: '',
                                                apiKey: '',
                                                isCustom: true
                                            };
                                            setEditingProvider(newP);
                                        }}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-[14px] font-bold text-gray-700 hover:border-gray-400 transition-all shadow-sm active:scale-95"
                                    >
                                        <Plus size={16} />
                                        添加节点
                                    </button>
                                </div>

                                {accountSecretsMessage && (
                                    <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${accountSecretsStatus === 'error'
                                        ? 'border-red-200 bg-red-50 text-red-700'
                                        : 'border-green-200 bg-green-50 text-green-700'
                                        }`}>
                                        {accountSecretsMessage}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-4">
                                    {providers.map(p => (
                                        <div
                                            key={p.id}
                                            className={`bg-white border rounded-2xl p-5 transition-all flex items-center justify-between ${activeProviderId === p.id ? 'border-gray-200 ring-4 ring-gray-100 shadow-premium' : 'border-gray-100 hover:border-gray-200'}`}
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${activeProviderId === p.id ? 'bg-black text-white' : 'bg-gray-50 text-gray-400'}`}>
                                                    {p.id === 'gemini' ? <Zap size={24} /> : <Globe size={24} />}
                                                </div>
                                                <div>
                                                    <h5 className="text-lg font-bold text-gray-900 leading-tight mb-1">{p.name}</h5>
                                                    <div className="text-xs text-gray-400 font-medium truncate max-w-[240px]">{p.baseUrl || 'Default Endpoint'}</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setEditingProvider({ ...p })}
                                                    className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-gray-50 text-gray-400 hover:text-black transition-all"
                                                >
                                                    <Sliders size={18} />
                                                </button>
                                                {p.isCustom && (
                                                    <button
                                                        onClick={() => deleteProvider(p.id)}
                                                        className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                                                        title="删除节点"
                                                        aria-label="删除节点"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setActiveProviderId(p.id)}
                                                    className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeProviderId === p.id ? 'bg-black text-white' : 'bg-gray-50 text-gray-500 hover:text-black hover:bg-gray-100'}`}
                                                >
                                                    {activeProviderId === p.id ? '当前使用' : '切换节点'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-2 gap-6 mt-8">
                                    <SettingsCard title="交互增强" icon={<Zap size={18} />} description="全局生成设置">
                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl mt-4">
                                            <div>
                                                <div className="text-sm font-bold text-gray-800">并行任务数</div>
                                                <div className="text-xs text-gray-500 font-medium">建议设置 1-3</div>
                                            </div>
                                            <input
                                                type="number"
                                                value={concurrentCount}
                                                onChange={e => setConcurrentCount(Math.max(1, parseInt(e.target.value) || 1))}
                                                className="w-20 h-11 bg-white border border-gray-200 rounded-xl px-4 text-sm font-bold text-center outline-none focus:ring-4 focus:ring-black/5"
                                            />
                                        </div>
                                    </SettingsCard>
                                    
                                    <div className="space-y-4">
                                        <SettingsCard title="三方集成" icon={<Plus size={18} />}>
                                            <div className="space-y-4 mt-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Replicate Key</label>
                                                    <SettingsInput type="password" value={replicateKey} onChange={e => setReplicateKey(e.target.value)} placeholder="r8_..." />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Kling Key</label>
                                                    <SettingsInput type="password" value={klingKey} onChange={e => setKlingKey(e.target.value)} placeholder="kling-..." />
                                                </div>
                                            </div>
                                        </SettingsCard>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'mapping' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                    <div>
                                        <h4 className="text-xl font-display font-bold text-gray-900">模型映射</h4>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Workflow Model Routing</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            onClick={() => void handleRefreshModels()}
                                            disabled={isLoadingModels}
                                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:border-gray-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {isLoadingModels ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                            刷新所有供应商模型
                                        </button>
                                        <div className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-500">
                                            已接入 <span className="text-gray-900">{providers.length}</span> 个供应商
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-8">
                                    <div className="space-y-6">
                                        <SettingsCard
                                            title="映射类别"
                                            icon={<Bot size={18} />}
                                            description="按能力类别指定默认模型，后续工作区里的局部手动选择会在此基础上覆盖。"
                                        >
                                            <div className="space-y-3 pt-4">
                                                {categoryMeta.map((category) => {
                                                    const isActive = activeMappingCategory === category.id;
                                                    const selectedCount = getSelectedModels(category.id).length;
                                                    return (
                                                        <button
                                                            key={category.id}
                                                            onClick={() => setExpandedCategory(category.id)}
                                                            className={`w-full rounded-2xl border p-4 text-left transition-all ${
                                                                isActive
                                                                    ? 'bg-black text-white border-black shadow-lg shadow-black/10'
                                                                    : 'bg-white border-gray-200 hover:border-gray-400'
                                                            }`}
                                                        >
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div>
                                                                    <div className="text-sm font-bold tracking-tight">{category.label}</div>
                                                                    <div className={`text-xs mt-1 ${isActive ? 'text-white/70' : 'text-gray-500'}`}>
                                                                        {category.hint}
                                                                    </div>
                                                                </div>
                                                                <div className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                                                                    isActive ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-600'
                                                                }`}>
                                                                    {selectedCount} 已选
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </SettingsCard>

                                        <SettingsCard
                                            title="手动添加模型"
                                            icon={<Plus size={18} />}
                                            description="当接口不返回模型列表时，也可以手动指定供应商和模型 ID。"
                                        >
                                            <div className="space-y-3 pt-4">
                                                <div className="text-xs font-semibold text-gray-500">
                                                    当前类别: <span className="text-gray-900">{categoryMeta.find((item) => item.id === activeMappingCategory)?.label}</span>
                                                </div>
                                                <SettingsSelect
                                                    value={manualProviderId}
                                                    onChange={(e) => setManualProviderId(e.target.value)}
                                                >
                                                    {providers.map((provider) => (
                                                        <option key={provider.id} value={provider.id}>
                                                            {provider.name}
                                                        </option>
                                                    ))}
                                                </SettingsSelect>
                                                <SettingsInput
                                                    value={
                                                        activeMappingCategory === 'script'
                                                            ? manualScriptModel
                                                            : activeMappingCategory === 'image'
                                                                ? manualImageModel
                                                                : manualVideoModel
                                                    }
                                                    onChange={(e) => {
                                                        const nextValue = e.target.value;
                                                        if (activeMappingCategory === 'script') setManualScriptModel(nextValue);
                                                        else if (activeMappingCategory === 'image') setManualImageModel(nextValue);
                                                        else setManualVideoModel(nextValue);
                                                    }}
                                                    placeholder="输入完整模型 ID，例如 gemini-3.1-pro-preview"
                                                />
                                                <button
                                                    onClick={() => addManualModel(activeMappingCategory)}
                                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black text-white text-sm font-bold hover:bg-gray-800 transition-all"
                                                >
                                                    <Plus size={16} />
                                                    加入当前映射
                                                </button>
                                                {activeMappingCategory === 'image' && (
                                                    <button
                                                        onClick={() => setSelectedImageModels([AUTO_IMAGE_OPTION_ID])}
                                                        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                                                            selectedImageModels.includes(AUTO_IMAGE_OPTION_ID)
                                                                ? 'bg-gray-900 text-white border-gray-900'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                                                        }`}
                                                    >
                                                        <ImageIcon size={16} />
                                                        使用 Auto 图片路由
                                                    </button>
                                                )}
                                            </div>
                                        </SettingsCard>
                                    </div>

                                    <div className="space-y-6">
                                        <SettingsCard
                                            title="当前已选模型"
                                            icon={<Check size={18} />}
                                            description="这里保存的是全局默认映射。工作区局部手动选模型时，会优先覆盖这里。"
                                        >
                                            <div className="pt-4 space-y-4">
                                                {selectedModelsForExpanded.length > 1 && (
                                                    <div className="text-xs text-gray-500">
                                                        可直接拖拽已选模型调整顺序，排在前面的模型会在工作区里优先显示和优先路由。
                                                    </div>
                                                )}
                                                {activeMappingCategory === 'image' && (
                                                    <div className="text-xs text-gray-500">
                                                        可为每个图片模型单独指定 POST 路径。配置按“供应商 + 模型”隔离保存，同名模型不会互相覆盖；留空则继续使用系统默认路由。
                                                    </div>
                                                )}
                                                {selectedModelsForExpanded.length === 0 ? (
                                                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                                                        当前类别还没有选中模型。
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {selectedModelsForExpanded.map((entry, index) => {
                                                            const meta = getModelEntryMeta(activeMappingCategory, entry);
                                                            const imagePostPathConfig = getImageModelPostPathConfig(entry);
                                                            const shouldShowImageRouteFields =
                                                                activeMappingCategory === 'image' && entry !== AUTO_IMAGE_OPTION_ID;
                                                            const isImageRouteExpanded = expandedImageRouteEntries.includes(entry);
                                                            const resolvedImagePostPaths = getResolvedImageModelPostPathConfig({
                                                                providerId: meta.providerId,
                                                                modelId: meta.modelId,
                                                            });
                                                            const currentImagePostPathSummary =
                                                                resolvedImagePostPaths.withReferences === resolvedImagePostPaths.withoutReferences
                                                                    ? `当前 POST: ${resolvedImagePostPaths.withReferences}`
                                                                    : `当前 POST: 参考图 ${resolvedImagePostPaths.withReferences} · 无参考图 ${resolvedImagePostPaths.withoutReferences}`;
                                                            const showBeforeIndicator =
                                                                dragOverSelectedModel?.entry === entry &&
                                                                dragOverSelectedModel.position === 'before' &&
                                                                draggingSelectedModel !== entry;
                                                            const showAfterIndicator =
                                                                dragOverSelectedModel?.entry === entry &&
                                                                dragOverSelectedModel.position === 'after' &&
                                                                draggingSelectedModel !== entry;
                                                            return (
                                                                <div
                                                                    key={entry}
                                                                    draggable={selectedModelsForExpanded.length > 1}
                                                                    onDragStart={() => setDraggingSelectedModel(entry)}
                                                                    onDragEnd={clearSelectedModelDragState}
                                                                    onDragOver={(event) => {
                                                                        if (!draggingSelectedModel || draggingSelectedModel === entry) return;
                                                                        event.preventDefault();
                                                                        const position = getDropPosition(event);
                                                                        setDragOverSelectedModel((current) =>
                                                                            current?.entry === entry && current.position === position
                                                                                ? current
                                                                                : { entry, position }
                                                                        );
                                                                    }}
                                                                    onDragLeave={(event) => {
                                                                        const nextTarget = event.relatedTarget as Node | null;
                                                                        if (nextTarget && event.currentTarget.contains(nextTarget)) {
                                                                            return;
                                                                        }
                                                                        setDragOverSelectedModel((current) =>
                                                                            current?.entry === entry ? null : current
                                                                        );
                                                                    }}
                                                                    onDrop={(event) => {
                                                                        event.preventDefault();
                                                                        if (!draggingSelectedModel || draggingSelectedModel === entry) return;
                                                                        const fromIndex = selectedModelsForExpanded.indexOf(draggingSelectedModel);
                                                                        const position = getDropPosition(event);
                                                                        let targetIndex = index;
                                                                        if (position === 'after') {
                                                                            targetIndex += 1;
                                                                        }
                                                                        if (fromIndex < targetIndex) {
                                                                            targetIndex -= 1;
                                                                        }
                                                                        reorderSelectedModels(activeMappingCategory, fromIndex, targetIndex);
                                                                        clearSelectedModelDragState();
                                                                    }}
                                                                    className="relative"
                                                                >
                                                                    <div
                                                                        className={`pointer-events-none absolute left-4 right-4 top-0 h-0.5 -translate-y-1/2 rounded-full bg-blue-500 transition-opacity ${
                                                                            showBeforeIndicator ? 'opacity-100' : 'opacity-0'
                                                                        }`}
                                                                    />
                                                                    <div
                                                                        className={`pointer-events-none absolute left-4 right-4 bottom-0 h-0.5 translate-y-1/2 rounded-full bg-blue-500 transition-opacity ${
                                                                            showAfterIndicator ? 'opacity-100' : 'opacity-0'
                                                                        }`}
                                                                    />
                                                                    <div
                                                                        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all ${
                                                                            draggingSelectedModel === entry
                                                                                ? 'border-gray-900 bg-gray-900 text-white shadow-lg shadow-black/10'
                                                                                : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'
                                                                        } ${
                                                                            selectedModelsForExpanded.length > 1
                                                                                ? 'cursor-grab active:cursor-grabbing'
                                                                                : ''
                                                                        }`}
                                                                    >
                                                                        <div
                                                                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                                                                                draggingSelectedModel === entry
                                                                                    ? 'border-white/15 bg-white/10 text-white/80'
                                                                                    : 'border-gray-200 bg-gray-50 text-gray-500'
                                                                            }`}
                                                                            aria-hidden="true"
                                                                        >
                                                                            <GripVertical size={16} />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <span
                                                                                    className={`text-xs font-bold uppercase tracking-[0.18em] ${
                                                                                        draggingSelectedModel === entry ? 'text-white/55' : 'text-gray-400'
                                                                                    }`}
                                                                                >
                                                                                    #{index + 1}
                                                                                </span>
                                                                                <span className="truncate text-sm font-semibold">
                                                                                    {meta.displayLabel}
                                                                                </span>
                                                                                {shouldShowImageRouteFields && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(event) => {
                                                                                            event.stopPropagation();
                                                                                            toggleImageRouteEntryExpanded(entry);
                                                                                        }}
                                                                                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                                                                                            draggingSelectedModel === entry
                                                                                                ? 'border-white/15 bg-white/10 text-white/80 hover:bg-white/15'
                                                                                                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                                                                        }`}
                                                                                        aria-label={`${isImageRouteExpanded ? '收起' : '展开'} ${meta.displayLabel} 的 POST 路径设置`}
                                                                                    >
                                                                                        {isImageRouteExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                            <div
                                                                                className={`mt-1 text-xs ${
                                                                                    draggingSelectedModel === entry ? 'text-white/65' : 'text-gray-500'
                                                                                }`}
                                                                            >
                                                                                {meta.providerName}
                                                                            </div>
                                                                            {shouldShowImageRouteFields && (
                                                                                <div className="mt-1.5"
                                                                                >
                                                                                    <div
                                                                                        className={`truncate pr-2 text-[11px] ${
                                                                                            draggingSelectedModel === entry ? 'text-white/45' : 'text-gray-400'
                                                                                        }`}
                                                                                        title={currentImagePostPathSummary}
                                                                                    >
                                                                                        {currentImagePostPathSummary}
                                                                                    </div>
                                                                                    {isImageRouteExpanded && (
                                                                                        <div className="mt-2.5 grid grid-cols-1 xl:grid-cols-2 gap-2.5 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-3">
                                                                                            <div className="space-y-1">
                                                                                                <label
                                                                                                    className={`block text-[11px] font-semibold ${
                                                                                                        draggingSelectedModel === entry ? 'text-white/70' : 'text-gray-500'
                                                                                                    }`}
                                                                                                >
                                                                                                    有参考图 / 蒙版
                                                                                                </label>
                                                                                                <div className={draggingSelectedModel === entry ? 'text-[10px] text-white/40' : 'text-[10px] text-gray-400'}>
                                                                                                    默认 {resolvedImagePostPaths.defaultWithReferences}
                                                                                                </div>
                                                                                                <input
                                                                                                    value={imagePostPathConfig.withReferences}
                                                                                                    onChange={(event) => updateImageModelPostPath(entry, 'withReferences', event.target.value)}
                                                                                                    placeholder={resolvedImagePostPaths.defaultWithReferences}
                                                                                                    onClick={(event) => event.stopPropagation()}
                                                                                                    className={`h-9 w-full rounded-lg border px-3 text-sm outline-none transition-all ${
                                                                                                        draggingSelectedModel === entry
                                                                                                            ? 'border-white/15 bg-black/10 text-white placeholder:text-white/30'
                                                                                                            : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-black/5'
                                                                                                    }`}
                                                                                                />
                                                                                            </div>
                                                                                            <div className="space-y-1">
                                                                                                <label
                                                                                                    className={`block text-[11px] font-semibold ${
                                                                                                        draggingSelectedModel === entry ? 'text-white/70' : 'text-gray-500'
                                                                                                    }`}
                                                                                                >
                                                                                                    无参考图
                                                                                                </label>
                                                                                                <div className={draggingSelectedModel === entry ? 'text-[10px] text-white/40' : 'text-[10px] text-gray-400'}>
                                                                                                    默认 {resolvedImagePostPaths.defaultWithoutReferences}
                                                                                                </div>
                                                                                                <input
                                                                                                    value={imagePostPathConfig.withoutReferences}
                                                                                                    onChange={(event) => updateImageModelPostPath(entry, 'withoutReferences', event.target.value)}
                                                                                                    placeholder={resolvedImagePostPaths.defaultWithoutReferences}
                                                                                                    onClick={(event) => event.stopPropagation()}
                                                                                                    className={`h-9 w-full rounded-lg border px-3 text-sm outline-none transition-all ${
                                                                                                        draggingSelectedModel === entry
                                                                                                            ? 'border-white/15 bg-black/10 text-white placeholder:text-white/30'
                                                                                                            : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-black/5'
                                                                                                    }`}
                                                                                                />
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <button
                                                                            onClick={() => removeSelectedModel(activeMappingCategory, entry)}
                                                                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                                                                                draggingSelectedModel === entry
                                                                                    ? 'text-white/70 hover:bg-white/10 hover:text-white'
                                                                                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                                                                            }`}
                                                                            aria-label={`移除 ${meta.displayLabel}`}
                                                                        >
                                                                            <X size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </SettingsCard>

                                        <SettingsCard
                                            title="可选模型库"
                                            icon={<Search size={18} />}
                                            description="已聚合所有供应商返回的模型列表，可以直接跨供应商指定默认映射。"
                                        >
                                            <div className="space-y-4 pt-4">
                                                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] gap-4">
                                                    <div className="relative">
                                                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                                        <input
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            placeholder="搜索模型 ID"
                                                            className="w-full h-12 rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm outline-none focus:ring-4 focus:ring-black/5"
                                                        />
                                                    </div>
                                                    <SettingsSelect
                                                        value={brandFilter}
                                                        onChange={(e) => setBrandFilter(e.target.value)}
                                                    >
                                                        <option value="all">全部品牌</option>
                                                        {availableBrands.map((brand) => (
                                                            <option key={brand} value={brand}>
                                                                {brand}
                                                            </option>
                                                        ))}
                                                    </SettingsSelect>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                                    <span className="font-semibold">当前类别:</span>
                                                    <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                                                        {categoryMeta.find((item) => item.id === activeMappingCategory)?.label}
                                                    </span>
                                                    <span className="font-semibold">候选模型:</span>
                                                    <span>{filteredModels.length}</span>
                                                </div>

                                                {visibleModels.length === 0 ? (
                                                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-sm text-gray-500">
                                                        当前筛选条件下没有可选模型。可以先刷新模型列表，或手动输入模型 ID。
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
                                                        {visibleModels.map((model) => (
                                                            <ModelCard
                                                                key={`${model.providerId || 'default'}-${model.category}-${model.id}`}
                                                                model={model}
                                                                isSelected={isModelSelected(model.category, model)}
                                                                onToggle={() => toggleModel(model.category, model)}
                                                                providerName={model.provider || providers.find((item) => item.id === model.providerId)?.name || model.providerId || '默认供应商'}
                                                            />
                                                        ))}
                                                    </div>
                                                )}

                                                {visibleModels.length < filteredModels.length && (
                                                    <button
                                                        onClick={() => setVisibleCount((prev) => prev + 60)}
                                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:border-gray-400 transition-all"
                                                    >
                                                        加载更多
                                                    </button>
                                                )}
                                            </div>
                                        </SettingsCard>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'search' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                    <div>
                                        <h4 className="text-xl font-display font-bold text-gray-900">网络搜索</h4>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">User-owned Search Providers</p>
                                    </div>
                                    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs leading-6 text-gray-500 max-w-2xl">
                                        密钥仅保存在本机；登录后可随账号加密同步。
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-8">
                                    <SettingsCard
                                        title="搜索服务商"
                                        icon={<Search size={18} />}
                                        description="先支持 5 个常用服务商。"
                                    >
                                        <div className="space-y-5 pt-4">
                                            {searchProviderGroups.map((group: { id: string; label: string; items: SearchProviderCatalogItem[] }) => (
                                                <div key={group.id} className="space-y-3">
                                                    <div className="px-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                                                        {group.label}
                                                    </div>
                                                    <div className="space-y-3">
                                                        {group.items.map((catalog: SearchProviderCatalogItem) => {
                                                            const provider = searchProviders.find((item) => item.id === catalog.id || item.catalogId === catalog.id);
                                                            if (!provider) return null;
                                                            const isSelected = provider.id === selectedSearchProviderId;
                                                            const isDefault = provider.id === activeSearchProviderId;
                                                            const capabilityText = catalog.supports.includes('images')
                                                                ? '网页 / 图片'
                                                                : '网页';
                                                            return (
                                                                <button
                                                                    key={provider.id}
                                                                    type="button"
                                                                    onClick={() => setSelectedSearchProviderId(provider.id)}
                                                                    className={`w-full rounded-2xl border p-4 text-left transition-all ${
                                                                        isSelected
                                                                            ? 'bg-black text-white border-black shadow-lg shadow-black/10'
                                                                            : 'bg-white border-gray-200 hover:border-gray-400'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-start justify-between gap-4">
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                                                                                    isSelected
                                                                                        ? 'border-white/15 bg-white/10 text-white'
                                                                                        : 'border-gray-200 bg-gray-50 text-gray-500'
                                                                                }`}>
                                                                                    {getSearchProviderIcon(provider)}
                                                                                </div>
                                                                                <div className="min-w-0 flex-1">
                                                                                    <div className="truncate text-sm font-bold tracking-tight">{catalog.shortLabel || catalog.label}</div>
                                                                                    <div className={`mt-1 text-[11px] leading-5 ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>
                                                                                        {catalog.description}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex shrink-0 flex-col items-end gap-2">
                                                                            <div className="flex flex-wrap justify-end gap-2">
                                                                                {isDefault && (
                                                                                    <div className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                                                                        isSelected ? 'bg-white text-black' : 'bg-black text-white'
                                                                                    }`}>
                                                                                        默认
                                                                                    </div>
                                                                                )}
                                                                                <div className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                                                                    isSelected ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-600'
                                                                                }`}>
                                                                                    {getSearchProviderBadge(provider)}
                                                                                </div>
                                                                            </div>
                                                                            <div className={`text-[10px] ${isSelected ? 'text-white/60' : 'text-gray-400'}`}>
                                                                                {capabilityText}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </SettingsCard>

                                    <div className="space-y-6">
                                        <SettingsCard
                                            title="当前服务商配置"
                                            icon={<Key size={18} />}
                                            description="填写当前服务商需要的 Key 和地址。"
                                        >
                                            <div className="pt-4 space-y-5">
                                                <div className="rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-4">
                                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-bold text-gray-900">{searchProviderMeta.endpointLabel}</div>
                                                            <div className="mt-1 text-xs leading-6 text-gray-500">{searchProviderMeta.endpointHint}</div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (!activeSearchProvider) return;
                                                                    persistSearchSettings({
                                                                        activeProviderId: activeSearchProvider.id,
                                                                        selectedProviderId: activeSearchProvider.id,
                                                                    });
                                                                }}
                                                                disabled={activeSearchProvider?.id === activeSearchProviderId}
                                                                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                                                                    activeSearchProvider?.id === activeSearchProviderId
                                                                        ? 'border border-black bg-black text-white cursor-default'
                                                                        : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                                                                }`}
                                                            >
                                                                <Check size={14} />
                                                                {activeSearchProvider?.id === activeSearchProviderId ? '当前默认服务' : '设为默认服务'}
                                                            </button>
                                                            <a
                                                                href={searchProviderMeta.docsHref}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:border-gray-400 transition-all"
                                                            >
                                                                <Globe size={14} />
                                                                {searchProviderMeta.docsLabel}
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px] gap-4 items-start">
                                                    <div className="space-y-2 min-w-0">
                                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest ml-1">API Key / Token</label>
                                                        <div className="relative">
                                                            <textarea
                                                                value={activeSearchProvider?.apiKey || ''}
                                                                onChange={(event) => {
                                                                    if (!activeSearchProvider) return;
                                                                    updateSearchProvider(activeSearchProvider.id, (provider) => ({
                                                                        ...provider,
                                                                        apiKey: event.target.value,
                                                                    }));
                                                                }}
                                                                placeholder={searchProviderMeta.apiKeyPlaceholder}
                                                                rows={4}
                                                                className="w-full bg-gray-50/50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-4 focus:ring-black/5 focus:border-gray-400 block px-4 py-3 pr-12 outline-none transition-all placeholder:text-gray-400 resize-y min-h-[104px]"
                                                                style={{ WebkitTextSecurity: showSearchProviderKeys ? 'none' : 'disc' } as any}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowSearchProviderKeys((value) => !value)}
                                                                className="absolute top-2.5 right-2.5 w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-100 transition"
                                                                title={showSearchProviderKeys ? '隐藏密钥' : '显示密钥'}
                                                            >
                                                                {showSearchProviderKeys ? <EyeOff size={16} /> : <Eye size={16} />}
                                                            </button>
                                                        </div>
                                                        <p className="text-[11px] leading-5 text-gray-500 px-1">
                                                            支持粘贴完整 Key 或 Token。
                                                        </p>
                                                    </div>

                                                    <div className="space-y-2 min-w-0">
                                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest ml-1">能力概览</label>
                                                        <div className="flex min-h-[104px] flex-wrap content-start gap-2 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3">
                                                            {(activeSearchCatalog?.badges || [getSearchProviderBadge(activeSearchProvider)]).map((badge: string) => (
                                                                <span
                                                                    key={badge}
                                                                    className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-bold text-gray-700 border border-gray-200"
                                                                >
                                                                    {badge}
                                                                </span>
                                                            ))}
                                                            {activeSearchCatalog?.supports.includes('web') && (
                                                                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-bold text-gray-700 border border-gray-200">
                                                                    网页搜索
                                                                </span>
                                                            )}
                                                            {activeSearchCatalog?.supports.includes('images') && (
                                                                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-bold text-gray-700 border border-gray-200">
                                                                    图片搜索
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] leading-5 text-gray-500 px-1">
                                                            这里只展示这个服务商当前可用的能力。
                                                        </p>
                                                    </div>
                                                </div>

                                                {searchProviderMeta.supportsBaseUrl && (
                                                    <div className="space-y-2">
                                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                                                            {searchProviderMeta.baseUrlLabel}
                                                            {searchProviderMeta.baseUrlRequired ? ' *' : ''}
                                                        </label>
                                                        <SettingsInput
                                                            value={activeSearchProvider?.baseUrl || ''}
                                                            onChange={(event) => {
                                                                if (!activeSearchProvider) return;
                                                                updateSearchProvider(activeSearchProvider.id, (provider) => ({
                                                                    ...provider,
                                                                    baseUrl: event.target.value,
                                                                }));
                                                            }}
                                                            placeholder={searchProviderMeta.baseUrlPlaceholder}
                                                        />
                                                        <p className="text-[11px] leading-5 text-gray-500 px-1">
                                                            {searchProviderMeta.baseUrlDescription}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </SettingsCard>

                                        <SettingsCard
                                            title="默认搜索行为"
                                            icon={<Sliders size={18} />}
                                            description="设置默认联网搜索选项。"
                                        >
                                            <div className="space-y-2 mt-4">
                                                <SettingsControl label="默认启用联网搜索" description="后续任务默认可调用联网搜索。">
                                                    <SettingsToggle
                                                        active={searchDefaults.enabledByDefault}
                                                        onClick={() => updateSearchDefaults('enabledByDefault', !searchDefaults.enabledByDefault)}
                                                    />
                                                </SettingsControl>
                                                <SettingsControl label="搜索模式" description="默认搜索网页、图片或两者。">
                                                    <div className="w-[220px] max-w-full">
                                                        <SettingsSelect
                                                            value={searchDefaults.mode}
                                                            onChange={(event) => updateSearchDefaults('mode', event.target.value as SearchDefaultsConfig['mode'])}
                                                        >
                                                            <option value="web+images">网页 + 图片</option>
                                                            <option value="web">仅网页</option>
                                                            <option value="images">仅图片</option>
                                                        </SettingsSelect>
                                                    </div>
                                                </SettingsControl>
                                                <SettingsControl label="安全过滤" description="过滤敏感内容。">
                                                    <div className="w-[220px] max-w-full">
                                                        <SettingsSelect
                                                            value={searchDefaults.safeSearch}
                                                            onChange={(event) => updateSearchDefaults('safeSearch', event.target.value as SearchDefaultsConfig['safeSearch'])}
                                                        >
                                                            <option value="off">关闭</option>
                                                            <option value="moderate">适中</option>
                                                            <option value="strict">严格</option>
                                                        </SettingsSelect>
                                                    </div>
                                                </SettingsControl>
                                                <SettingsControl label="时间范围" description="限制网页结果时间范围。">
                                                    <div className="w-[220px] max-w-full">
                                                        <SettingsSelect
                                                            value={searchDefaults.timeRange}
                                                            onChange={(event) => updateSearchDefaults('timeRange', event.target.value as SearchDefaultsConfig['timeRange'])}
                                                        >
                                                            <option value="any">不限</option>
                                                            <option value="day">最近 1 天</option>
                                                            <option value="week">最近 1 周</option>
                                                            <option value="month">最近 1 月</option>
                                                            <option value="year">最近 1 年</option>
                                                        </SettingsSelect>
                                                    </div>
                                                </SettingsControl>
                                                <SettingsControl label="结果压缩策略" description="控制后续摘要压缩方式。">
                                                    <div className="w-[220px] max-w-full">
                                                        <SettingsSelect
                                                            value={searchDefaults.compressionMode}
                                                            onChange={(event) => updateSearchDefaults('compressionMode', event.target.value as SearchDefaultsConfig['compressionMode'])}
                                                        >
                                                            <option value="balanced">Balanced</option>
                                                            <option value="none">None</option>
                                                        </SettingsSelect>
                                                    </div>
                                                </SettingsControl>
                                                <SettingsControl label="结果附带日期" description="在结果中保留日期信息。">
                                                    <SettingsToggle
                                                        active={searchDefaults.includeDate}
                                                        onClick={() => updateSearchDefaults('includeDate', !searchDefaults.includeDate)}
                                                    />
                                                </SettingsControl>
                                            </div>
                                        </SettingsCard>

                                        <SettingsCard
                                            title="结果规模与过滤"
                                            icon={<Box size={18} />}
                                            description="控制返回数量和屏蔽站点。"
                                        >
                                            <div className="pt-4 space-y-5">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest ml-1">网页结果数</label>
                                                        <SettingsInput
                                                            type="number"
                                                            min={1}
                                                            max={20}
                                                            value={searchDefaults.webCount}
                                                            onChange={(event) => updateSearchDefaults('webCount', Math.max(1, Math.min(20, Number.parseInt(event.target.value || '8', 10) || 8)))}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest ml-1">图片结果数</label>
                                                        <SettingsInput
                                                            type="number"
                                                            min={1}
                                                            max={50}
                                                            value={searchDefaults.imageCount}
                                                            onChange={(event) => updateSearchDefaults('imageCount', Math.max(1, Math.min(50, Number.parseInt(event.target.value || '16', 10) || 16)))}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest ml-1">屏蔽域名（每行一个）</label>
                                                    <textarea
                                                        value={blockedDomainsText}
                                                        onChange={(event) => {
                                                            const nextBlockedDomains = event.target.value
                                                                .split(/\r?\n/)
                                                                .map((item) => item.trim())
                                                                .filter(Boolean);
                                                            updateSearchDefaults('blockedDomains', Array.from(new Set(nextBlockedDomains)));
                                                        }}
                                                        placeholder={'example.com\nsubdomain.example.org'}
                                                        rows={5}
                                                        className="w-full bg-gray-50/50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-4 focus:ring-black/5 focus:border-gray-400 block px-4 py-3 outline-none transition-all placeholder:text-gray-400 resize-y min-h-[120px]"
                                                    />
                                                    <p className="text-[11px] leading-5 text-gray-500 px-1">
                                                        每行一个域名，例如 <span className="font-mono">pinterest.com</span>。
                                                    </p>
                                                </div>
                                            </div>
                                        </SettingsCard>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'hosting' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <SettingsCard title="图床服务商" icon={<ImageIcon size={18} />} description="选择图片存储方案（用于智能视觉记忆）">
                                        <div className="space-y-4 pt-4">
                                            {(['none', 'imgbb', 'custom'] as const).map((providerId) => ( /* cspell:disable-line */
                                                <button
                                                    key={providerId}
                                                    onClick={() => imageHost.actions.setSelectedProvider(providerId)}
                                                    className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all group ${
                                                        imageHost.selectedProvider === providerId 
                                                            ? 'bg-primary/5 border-primary shadow-sm' 
                                                            : 'bg-card border-border/50 hover:bg-muted/50'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-2 rounded-lg ${
                                                            imageHost.selectedProvider === providerId ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                                                        }`}>
                                                            {providerId === 'none' ? <X size={16} /> : providerId === 'imgbb' ? <ImageIcon size={16} /> : <Globe size={16} />} {/* cspell:disable-line */}
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="text-[15px] font-bold">{providerId === 'none' ? '不启用' : providerId === 'imgbb' ? 'ImgBB' : '自定义 API'}</div> {/* cspell:disable-line */}
                                                            <div className="text-[11px] text-muted-foreground uppercase tracking-widest px-0.5">{providerId === 'none' ? '仅使用临时链接' : providerId === 'imgbb' ? '官方 API' : '兼容协议'}</div> {/* cspell:disable-line */}
                                                        </div>
                                                    </div>
                                                    {imageHost.selectedProvider === providerId && <Check size={16} className="text-primary" />}
                                                </button>
                                            ))}
                                        </div>
                                    </SettingsCard>

                                    {imageHost.selectedProvider === 'imgbb' && ( /* cspell:disable-line */
                                        <SettingsCard title="ImgBB 参数" icon={<Key size={18} />}> {/* cspell:disable-line */}
                                            <div className="space-y-4 mt-4">
                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">API KEY (每行一个，轮询)</label>
                                                    <div className="relative">
                                                        <textarea
                                                            value={imageHost.imgbbKey} // cspell:disable-line
                                                            onChange={(e) => imageHost.actions.setImgbbKey(e.target.value)} // cspell:disable-line
                                                            placeholder="支持多 Key，换行分隔"
                                                            rows={4}
                                                            className="w-full bg-muted/50 border border-border/80 text-foreground text-sm rounded-md focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-card block px-3 py-2 pr-12 outline-none transition-all placeholder:text-muted-foreground/50 resize-y min-h-[96px]"
                                                            style={{ WebkitTextSecurity: showImgBBKeys ? 'none' : 'disc' } as any}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowImgBBKeys(v => !v)}
                                                            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-100 transition"
                                                            title={showImgBBKeys ? '隐藏密钥' : '显示密钥'}
                                                        >
                                                            {showImgBBKeys ? <EyeOff size={16} /> : <Eye size={16} />}
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
                                                    从 <a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">ImgBB API</a> 获取密钥。免费版支持无限存储量。 {/* cspell:disable-line */}
                                                </p>
                                            </div>
                                        </SettingsCard>
                                    )}

                                    {imageHost.selectedProvider === 'custom' && (
                                        <SettingsCard title="自定义图床" icon={<Globe size={18} />}>
                                            <div className="space-y-4 mt-4">
                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">上传地址 (Upload URL)</label>
                                                    <SettingsInput 
                                                        value={imageHost.customConfig.uploadUrl} 
                                                        onChange={(e) => imageHost.actions.setCustomConfig({ uploadUrl: e.target.value })} 
                                                        placeholder="https://your-host.com/api/upload" 
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">身份验证 (Auth Token，多行轮询)</label>
                                                    <div className="relative">
                                                        <textarea
                                                            value={imageHost.customConfig.apiKey}
                                                            onChange={(e) => imageHost.actions.setCustomConfig({ apiKey: e.target.value })}
                                                            placeholder="支持多 Key，换行分隔"
                                                            rows={4}
                                                            className="w-full bg-muted/50 border border-border/80 text-foreground text-sm rounded-md focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-card block px-3 py-2 pr-12 outline-none transition-all placeholder:text-muted-foreground/50 resize-y min-h-[96px]"
                                                            style={{ WebkitTextSecurity: showCustomHostKeys ? 'none' : 'disc' } as any}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowCustomHostKeys(v => !v)}
                                                            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-100 transition"
                                                            title={showCustomHostKeys ? '隐藏密钥' : '显示密钥'}
                                                        >
                                                            {showCustomHostKeys ? <EyeOff size={16} /> : <Eye size={16} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </SettingsCard>
                                    )}
                                </div>
                            </div>
                        )}
                        {activeTab === 'advanced' && (
                            <div className="max-w-3xl space-y-6">
                                <SettingsCard title="体验优化" icon={<Zap size={18} />}>
                                    <div className="space-y-2 mt-4">
                                        <SettingsControl label="视觉编排模型" description="用于后续通用视觉编排层的大模型规划。现在先作为全局设置保留，后续可直接切换生效。">
                                            <div className="w-[340px]">
                                                <SettingsSelect
                                                    value={visualOrchestratorModel}
                                                    onChange={(e) => setVisualOrchestratorModel(e.target.value)}
                                                >
                                                    {visualOrchestratorModelOptions.map((option) => (
                                                        <option key={option.entry} value={option.entry}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </SettingsSelect>
                                            </div>
                                        </SettingsControl>
                                        <SettingsControl label="Browser Agent 模型" description="用于网页原生 agent 的目标规划与工具编排。后续 goal session 会直接读取这里的模型。">
                                            <div className="w-[340px]">
                                                <SettingsSelect
                                                    value={browserAgentModel}
                                                    onChange={(e) => setBrowserAgentModel(e.target.value)}
                                                >
                                                    {browserAgentModelOptions.map((option) => (
                                                        <option key={option.entry} value={option.entry}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </SettingsSelect>
                                            </div>
                                        </SettingsControl>
                                        <SettingsControl label="编排参考图上限" description="0 表示不按张数限制。若超过这里的值，视觉编排会直接报错，不会偷偷忽略后面的参考图。">
                                            <div className="w-[140px]">
                                                <SettingsInput
                                                    type="number"
                                                    min={0}
                                                    max={64}
                                                    value={visualOrchestratorMaxReferenceImages}
                                                    onChange={(e) => setVisualOrchestratorMaxReferenceImages(Math.max(0, Math.min(64, Number.parseInt(e.target.value || '0', 10) || 0)))}
                                                />
                                            </div>
                                        </SettingsControl>
                                        <SettingsControl label="编排图片预算" description="视觉编排模型可读取的参考图总预算，单位 MB。默认 48MB；单张参考图超过 8MB 时会先自动压缩，再参与预算计算。">
                                            <div className="w-[140px]">
                                                <SettingsInput
                                                    type="number"
                                                    min={1}
                                                    max={64}
                                                    value={visualOrchestratorMaxInlineImageBytesMb}
                                                    onChange={(e) => setVisualOrchestratorMaxInlineImageBytesMb(Math.max(1, Math.min(64, Number.parseInt(e.target.value || '48', 10) || 48)))}
                                                />
                                            </div>
                                        </SettingsControl>
                                        <SettingsControl label="视觉一致性" description="智能体在多个生成步骤间保持视觉特征。">
                                            <SettingsToggle active={visualContinuity} onClick={() => setVisualContinuity(!visualContinuity)} />
                                        </SettingsControl>
                                        <SettingsControl label="安全过滤" description="启用系统内置的合规性预警流程。">
                                            <SettingsToggle active={systemModeration} onClick={() => setSystemModeration(!systemModeration)} />
                                        </SettingsControl>
                                        <SettingsControl label="自动保存" description="工作进度的后台即时备份（每 5 分钟）。">
                                            <SettingsToggle active={autoSave} onClick={() => setAutoSave(!autoSave)} />
                                        </SettingsControl>
                                    </div>
                                </SettingsCard>
                            </div>
                        )}

                        {activeTab === 'about' && (
                            <div className="space-y-10 max-w-4xl mx-auto">
                                <div className="bg-foreground p-12 lg:p-16 rounded-lg text-background relative overflow-hidden shadow-2xl">
                                    <div className="relative z-10">
                                        <h4 className="text-5xl lg:text-7xl font-display font-bold mb-4 tracking-tighter">Jacky-Studio</h4>
                                        <p className="text-primary text-xs lg:text-sm font-bold uppercase tracking-[0.4em] mb-12">System Architecture Engine V4.2.0</p>
                                        <div className="flex flex-wrap gap-4">
                                            <div className="px-5 py-2 bg-background/10 rounded-md text-[10px] font-bold backdrop-blur-md border border-background/20 uppercase tracking-widest">PRODUCTION STABLE</div>
                                            <div className="px-5 py-2 bg-primary rounded-md text-[10px] font-bold shadow-lg shadow-primary/20 uppercase tracking-widest">AGENT CORE UPGRADED</div>
                                        </div>
                                    </div>
                                    <Zap size={280} className="absolute -right-12 -bottom-12 opacity-5 rotate-12 text-background fill-background" />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <SettingsCard title="系统信息" icon={<Info size={18} />}>
                                        <div className="mt-4 space-y-4">
                                            <div className="flex items-center justify-between py-2 border-b border-border/30">
                                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">内核版本</span>
                                                <span className="font-mono font-bold text-primary text-xs">v4.2.1-SR2</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">开发代号</span>
                                                <span className="font-display font-bold text-foreground text-xs tracking-tight">Antigravity</span>
                                            </div>
                                        </div>
                                    </SettingsCard>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* Provider Edit Overlay */}
            <AnimatePresence>
                {editingProvider && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl p-8 w-full max-w-xl shadow-2xl relative border border-gray-100"
                        >
                            <button 
                                onClick={() => setEditingProvider(null)}
                                className="absolute right-8 top-8 p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-xl transition-all"
                            >
                                <X size={20} />
                            </button>

                            <h4 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                                <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center">
                                    <Plus size={20} />
                                </div>
                                {editingProvider.isCustom ? '配置新节点' : '编辑节点参数'}
                            </h4>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">节点名称</label>
                                    <SettingsInput 
                                        value={editingProvider.name} 
                                        onChange={e => setEditingProvider({ ...editingProvider, name: e.target.value })} 
                                        placeholder="例如：Gemini 代理" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">API 端点 (Base URL)</label>
                                    <SettingsInput 
                                        value={editingProvider.baseUrl} 
                                        onChange={e => setEditingProvider({ ...editingProvider, baseUrl: e.target.value })} 
                                        placeholder="https://..." 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">API 密钥 (支持多行轮询)</label>
                                    <textarea
                                        value={editingProvider.apiKey}
                                        onChange={e => setEditingProvider({ ...editingProvider, apiKey: e.target.value })}
                                        placeholder="粘贴 API Key，每行一个"
                                        className="w-full h-32 p-5 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-mono outline-none focus:ring-4 focus:ring-black/5 focus:border-black transition-all resize-none"
                                    />
                                </div>
                            </div>

                            <div className="mt-10 flex gap-4">
                                <button
                                    onClick={() => setEditingProvider(null)}
                                    className="flex-1 py-3.5 bg-gray-50 rounded-xl text-xs font-bold text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-all uppercase tracking-widest"
                                >
                                    放弃
                                </button>
                                <button
                                    onClick={() => {
                                        setProviders(prev => {
                                            const idx = prev.findIndex(p => p.id === editingProvider.id);
                                            if (idx > -1) {
                                                const next = [...prev];
                                                next[idx] = editingProvider;
                                                return next;
                                            }
                                            return [...prev, editingProvider];
                                        });
                                        setEditingProvider(null);
                                    }}
                                    className="flex-1 py-3.5 bg-black rounded-xl text-xs font-bold text-white shadow-lg hover:bg-gray-800 transition-all uppercase tracking-widest"
                                >
                                    确认部署
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SettingsPage;
