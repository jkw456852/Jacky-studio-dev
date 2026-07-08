import { lazy, Suspense, type FC, type PropsWithChildren, type ReactNode } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

type AssistantSidebarProps = PropsWithChildren<{
  sidebar?: ReactNode;
}>;

const DefaultThread = lazy(async () => {
  const module = await import("@/components/assistant-ui/thread");
  return { default: module.Thread };
});

export const AssistantSidebar: FC<AssistantSidebarProps> = ({
  children,
  sidebar,
}) => {
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-full w-full bg-[linear-gradient(180deg,#fafbfd_0%,#f4f6fa_100%)]"
    >
      <ResizablePanel defaultSize="60%" minSize="30%">
        {children}
      </ResizablePanel>
      <ResizableHandle
        withHandle
        className="border-x border-slate-300/90 bg-[linear-gradient(180deg,#e2e8f0_0%,#cbd5e1_100%)] transition-colors hover:border-slate-400/90 hover:bg-[linear-gradient(180deg,#cbd5e1_0%,#94a3b8_100%)]"
      />
      <ResizablePanel
        defaultSize="40%"
        minSize="20%"
        maxSize="48%"
        className="border-l border-slate-200/80 bg-white/95"
      >
        {sidebar ?? (
          <Suspense fallback={null}>
            <DefaultThread />
          </Suspense>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};
