import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type AssistantSidebarStatusBannerProps = {
    label: string | null;
    statusKey?: string;
    hideWhenEmpty?: boolean;
};

export const AssistantSidebarStatusBanner: React.FC<AssistantSidebarStatusBannerProps> = ({
    label,
    statusKey,
    hideWhenEmpty = false,
}) => {
    const tone =
        statusKey === 'executing'
            ? {
                border: 'border-blue-200/80',
                bg: 'bg-blue-50/78',
                dot: 'bg-blue-500',
                text: 'text-blue-700',
            }
            : statusKey === 'analyzing'
                ? {
                    border: 'border-sky-200/80',
                    bg: 'bg-sky-50/78',
                    dot: 'bg-sky-500',
                    text: 'text-sky-700',
                }
                : statusKey === 'completed'
                    ? {
                        border: 'border-emerald-200/80',
                        bg: 'bg-emerald-50/78',
                        dot: 'bg-emerald-500',
                        text: 'text-emerald-700',
                    }
                    : statusKey === 'failed'
                        ? {
                            border: 'border-amber-200/80',
                            bg: 'bg-amber-50/78',
                            dot: 'bg-amber-500',
                            text: 'text-amber-700',
                        }
                        : {
                            border: 'border-slate-200/80',
                            bg: 'bg-white/82',
                            dot: 'bg-slate-400',
                            text: 'text-slate-600',
                        };
    return (
        <AnimatePresence mode="wait">
            {label && !hideWhenEmpty && (
                <motion.div
                    key={statusKey}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className={`mx-5 mb-3 flex items-center gap-2 rounded-[16px] border px-3.5 py-2 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.16)] backdrop-blur-sm ${tone.border} ${tone.bg}`}
                >
                    <div className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
                    <span className={`min-w-0 truncate text-[12px] font-medium leading-5 ${tone.text}`}>
                        {label}
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
