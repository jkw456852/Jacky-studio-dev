"use client";

import { GripVerticalIcon } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

function ResizablePanelGroup({
  className,
  direction,
  orientation,
  ...props
}: ResizablePrimitive.GroupProps & {
  direction?: ResizablePrimitive.GroupProps["orientation"];
}) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      orientation={orientation ?? direction}
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

function ResizablePanel(props: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "bg-slate-300/90 focus-visible:ring-ring relative flex w-2 items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.72)] after:absolute after:inset-y-0 after:start-1/2 after:w-2 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-2 aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:start-0 aria-[orientation=horizontal]:after:h-2 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 rtl:after:translate-x-1/2 rtl:aria-[orientation=horizontal]:after:-translate-x-0 [&[aria-orientation=horizontal]>div]:rotate-90",
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <div className="bg-background text-muted-foreground z-10 flex h-5 w-4 items-center justify-center rounded-full border border-slate-300/90 shadow-sm">
          <GripVerticalIcon className="size-2.5" />
        </div>
      ) : null}
    </ResizablePrimitive.Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
