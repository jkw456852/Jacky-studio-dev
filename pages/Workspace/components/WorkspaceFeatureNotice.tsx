import React from "react";
import { AnimatePresence, motion } from "framer-motion";

type WorkspaceFeatureNoticeProps = {
  featureNotice: string | null;
};

export const WorkspaceFeatureNotice: React.FC<WorkspaceFeatureNoticeProps> = ({
  featureNotice,
}) => {
  return (
    <AnimatePresence>
      {featureNotice && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[120] bg-black/85 text-white px-4 py-2 rounded-full text-xs font-medium shadow-xl"
        >
          {featureNotice}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
