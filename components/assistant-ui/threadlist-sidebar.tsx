"use client";

import type * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { ThreadList } from "@/components/assistant-ui/thread-list";

export function ThreadListSidebar({
  className,
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      className={[
        "relative border-r border-slate-200/90 bg-white/98 backdrop-blur-md shadow-[1px_0_0_rgba(15,23,42,0.06)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <SidebarHeader className="border-b border-slate-200/80 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {"对话"}
            </div>
            <div className="truncate text-xs text-slate-500">
              {"历史话题"}
            </div>
          </div>
          <SidebarTrigger className="size-9 shrink-0 rounded-full border border-slate-200/80 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900" />
        </div>
      </SidebarHeader>
      <SidebarContent className="min-h-0 overflow-hidden px-2 py-2">
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto pr-1">
          <ThreadList />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
