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
        className="w-px bg-slate-200 shadow-none after:w-3 hover:bg-slate-300 focus-visible:bg-slate-300"
      />
      <ResizablePanel
        defaultSize="40%"
        minSize="20%"
        maxSize="48%"
        className="bg-white/95"
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
