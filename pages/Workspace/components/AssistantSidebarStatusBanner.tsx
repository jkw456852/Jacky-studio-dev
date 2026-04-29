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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="mx-5 mb-4 flex items-center gap-3 px-4 py-2.5 bg-[#F1F3F5] rounded-xl"
                >
                    <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center shadow-sm transform scale-90 text-white font-bold text-[9px] tracking-wide">
                        JK
                    </div>
                    <span className="text-[11px] font-bold text-gray-400">{label}</span>
                    <div className="flex items-center gap-1 opacity-10 ml-auto">
                        <span className="w-0.5 h-0.5 bg-gray-600 rounded-full animate-bounce"></span>
                        <span className="w-0.5 h-0.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};


