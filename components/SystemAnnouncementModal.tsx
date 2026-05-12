import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Beaker, Sparkles, Wrench, X } from "lucide-react";
import type { SystemAnnouncement } from "../services/systemAnnouncements";

interface SystemAnnouncementModalProps {
  isOpen: boolean;
  announcements: SystemAnnouncement[];
  onClose: () => void;
}

const sectionConfig = [
  {
    key: "features",
    title: "新功能",
    icon: Sparkles,
    emptyText: "这次没有上新功能，先把现有能力打磨稳一点。",
    accentClassName: "text-emerald-600 bg-emerald-50 border-emerald-100",
  },
  {
    key: "fixes",
    title: "修复问题",
    icon: Wrench,
    emptyText: "这次没有单独记录 bug 修复项。",
    accentClassName: "text-sky-600 bg-sky-50 border-sky-100",
  },
  {
    key: "experiments",
    title: "实验功能",
    icon: Beaker,
    emptyText: "这次没有挂出新的实验功能。",
    accentClassName: "text-amber-600 bg-amber-50 border-amber-100",
  },
] as const;

const SystemAnnouncementModal: React.FC<SystemAnnouncementModalProps> = ({
  isOpen,
  announcements,
  onClose,
}) => (
  <AnimatePresence>
    {isOpen ? (
      <motion.div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/28 px-4 py-6 backdrop-blur-[8px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={(event) => event.stopPropagation()}
          className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-[30px] border border-white/70 bg-[rgba(255,255,255,0.96)] shadow-[0_30px_90px_rgba(15,23,42,0.16)]"
          role="dialog"
          aria-modal="true"
          aria-label="系统公告"
        >
          <div className="border-b border-black/5 px-6 py-5 sm:px-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.16)]">
                  <Bell size={20} />
                </div>
                <div className="min-w-0">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                    系统公告
                  </div>
                  <h2 className="text-[26px] font-semibold tracking-tight text-gray-950">
                    最近更新，一眼看明白
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
                    只保留这次真正值得知道的功能更新、修复和还在试验中的东西，不写废话。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-black/5 bg-white text-gray-400 transition hover:border-black/10 hover:text-gray-900"
                aria-label="关闭系统公告"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="max-h-[calc(86vh-108px)] overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
            <div className="space-y-3">
              {announcements.map((announcement, index) => (
                <motion.section
                  key={announcement.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
                >
                  <div className="border-b border-black/5 px-5 py-4 sm:px-6">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {index === 0 ? "最新一条" : "历史更新"}
                      </span>
                      <span className="text-[11px] font-medium tracking-[0.14em] text-gray-400">
                        {announcement.date}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight text-gray-950 sm:text-[20px]">
                      {announcement.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {announcement.summary}
                    </p>
                  </div>

                  <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
                    {sectionConfig.map((section) => {
                      const Icon = section.icon;
                      const items = announcement[section.key];
                      return (
                        <div
                          key={section.key}
                          className="rounded-2xl border border-black/5 bg-slate-50/70 p-4"
                        >
                          <div
                            className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${section.accentClassName}`}
                          >
                            <Icon size={14} />
                            <span>{section.title}</span>
                          </div>
                          <div className="space-y-2 text-sm leading-6 text-gray-600">
                            {items.length > 0 ? (
                              items.map((item) => (
                                <p
                                  key={item}
                                  className="rounded-xl border border-white bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
                                >
                                  {item}
                                </p>
                              ))
                            ) : (
                              <p className="rounded-xl border border-white bg-white px-3 py-2.5 text-gray-400">
                                {section.emptyText}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.section>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);

export default SystemAnnouncementModal;
