"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const Sheet = ({ children, ...props }: React.ComponentProps<"div"> & { open?: boolean; onOpenChange?: (open: boolean) => void }) => {
  return (
    <div data-slot="sheet" {...props}>
      {children}
    </div>
  );
};

const SheetContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { side?: "left" | "right" }
>(({ className, side = "right", children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-slot="sheet-content"
      data-side={side}
      className={cn(
        "bg-background fixed inset-y-0 z-50 flex w-80 flex-col shadow-xl outline-none",
        side === "left" ? "left-0" : "right-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
SheetContent.displayName = "SheetContent";

const SheetHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div data-slot="sheet-header" className={cn("flex flex-col gap-2 p-4", className)} {...props} />
);

const SheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentProps<"h2">
>(({ className, ...props }, ref) => (
  <h2 ref={ref} data-slot="sheet-title" className={cn("text-lg font-semibold", className)} {...props} />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentProps<"p">
>(({ className, ...props }, ref) => (
  <p ref={ref} data-slot="sheet-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = "SheetDescription";

const SheetTrigger = ({ children }: React.ComponentProps<"button">) => <>{children}</>;

export {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
