import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type AssistantSidebarStatusBannerProps = {
    label: string | null;
    statusKey?: string;
};

export const AssistantSidebarStatusBanner: React.FC<AssistantSidebarStatusBannerProps> = ({
    label,
    statusKey,
}) => {
    return (
        <AnimatePresence mode="wait">
            {label && (
                <motion.div
                    key={statusKey}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mx-5 mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm"
                >
                    <div className="h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                    <span className="min-w-0 text-[12px] font-medium leading-5 text-gray-600 truncate">
                        {label}
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};


