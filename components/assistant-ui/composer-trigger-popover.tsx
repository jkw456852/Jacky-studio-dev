"use client";

import { memo, useRef, type ComponentPropsWithoutRef, type FC } from "react";
import {
  ComposerPrimitive,
  unstable_defaultDirectiveFormatter,
  unstable_useTriggerPopoverScopeContext,
  type Unstable_DirectiveFormatter,
  type Unstable_TriggerItem,
} from "@assistant-ui/react";
import { ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type IconComponent = FC<{ className?: string }>;

type DirectiveBehaviorProps = {
  formatter?: Unstable_DirectiveFormatter | undefined;
  onInserted?: ((item: Unstable_TriggerItem) => void) | undefined;
};

type ActionBehaviorProps = {
  formatter?: Unstable_DirectiveFormatter | undefined;
  onExecute: (item: Unstable_TriggerItem) => void;
  removeOnExecute?: boolean | undefined;
};

type ComposerTriggerPopoverBaseProps = Omit<
  ComponentPropsWithoutRef<typeof ComposerPrimitive.Unstable_TriggerPopover>,
  "children"
> & {
  iconMap?: Record<string, IconComponent>;
  fallbackIcon?: IconComponent;
  backLabel?: string;
  emptyCategoriesLabel?: string;
  emptyItemsLabel?: string;
  loadingLabel?: string;
};

type ComposerTriggerPopoverProps = ComposerTriggerPopoverBaseProps &
  (
    | { directive: DirectiveBehaviorProps; action?: never }
    | { action: ActionBehaviorProps; directive?: never }
  );

function resolveIcon(
  iconKey: string | undefined,
  iconMap: Record<string, IconComponent> | undefined,
  fallback: IconComponent,
): IconComponent {
  if (iconKey && iconMap?.[iconKey]) return iconMap[iconKey]!;
  return fallback;
}

const Categories: FC<{
  iconMap: Record<string, IconComponent> | undefined;
  fallbackIcon: IconComponent;
  emptyLabel: string;
}> = ({ iconMap, fallbackIcon, emptyLabel }) => (
  <ComposerPrimitive.Unstable_TriggerPopoverCategories>
    {(categories) => (
      <div className="flex flex-col py-1">
        {categories.map((category) => {
          const Icon = resolveIcon(category.id, iconMap, fallbackIcon);
          return (
            <ComposerPrimitive.Unstable_TriggerPopoverCategoryItem
              key={category.id}
              categoryId={category.id}
              className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm outline-none transition-colors hover:bg-slate-100 data-[highlighted]:bg-slate-100"
            >
              <span className="flex items-center gap-2">
                <Icon className="size-4 text-slate-500" />
                {category.label}
              </span>
              <ChevronRightIcon className="size-4 text-slate-400" />
            </ComposerPrimitive.Unstable_TriggerPopoverCategoryItem>
          );
        })}
        {categories.length === 0 ? (
          <div className="px-3 py-2 text-sm text-slate-500">{emptyLabel}</div>
        ) : null}
      </div>
    )}
  </ComposerPrimitive.Unstable_TriggerPopoverCategories>
);

const Items: FC<{
  iconMap: Record<string, IconComponent> | undefined;
  fallbackIcon: IconComponent;
  backLabel: string;
  emptyLabel: string;
  loadingLabel: string;
}> = ({ iconMap, fallbackIcon, backLabel, emptyLabel, loadingLabel }) => {
  const { isLoading } = unstable_useTriggerPopoverScopeContext();

  return (
    <ComposerPrimitive.Unstable_TriggerPopoverItems>
      {(items) => (
        <div className="flex flex-col">
          <ComposerPrimitive.Unstable_TriggerPopoverBack className="flex cursor-pointer items-center gap-1.5 border-b px-3 py-2 text-xs uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-100">
            <ChevronLeftIcon className="size-3.5" />
            {backLabel}
          </ComposerPrimitive.Unstable_TriggerPopoverBack>

          <div className="py-1">
            {items.map((item, index) => {
              const iconKey =
                typeof item.metadata?.icon === "string"
                  ? item.metadata.icon
                  : undefined;
              const Icon = resolveIcon(iconKey, iconMap, fallbackIcon);
              return (
                <ComposerPrimitive.Unstable_TriggerPopoverItem
                  key={item.id}
                  item={item}
                  index={index}
                  className="flex w-full cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-left outline-none transition-colors hover:bg-slate-100 data-[highlighted]:bg-slate-100"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-3.5 text-slate-700" />
                    {item.label}
                  </span>
                  {item.description ? (
                    <span className="ms-5.5 text-xs leading-tight text-slate-500">
                      {item.description}
                    </span>
                  ) : null}
                </ComposerPrimitive.Unstable_TriggerPopoverItem>
              );
            })}
            {items.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">
                {isLoading ? loadingLabel : emptyLabel}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </ComposerPrimitive.Unstable_TriggerPopoverItems>
  );
};

const ComposerTriggerPopoverImpl: FC<ComposerTriggerPopoverProps> = ({
  iconMap,
  fallbackIcon = SparklesIcon,
  backLabel = "返回",
  emptyCategoriesLabel = "暂无可用项",
  emptyItemsLabel = "没有匹配项",
  loadingLabel = "加载中...",
  className,
  directive,
  action,
  ...props
}) => {
  const warnedRef = useRef(false);
  if (
    process.env.NODE_ENV !== "production" &&
    !warnedRef.current &&
    Boolean(directive) === Boolean(action)
  ) {
    warnedRef.current = true;
    console.warn(
      "[assistant-ui] ComposerTriggerPopover requires exactly one of `directive` or `action` props.",
    );
  }

  return (
    <ComposerPrimitive.Unstable_TriggerPopover
      data-slot="composer-trigger-popover"
      className={cn(
        "absolute start-0 bottom-full z-50 mb-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg",
        className,
      )}
      {...props}
    >
      {directive ? (
        <ComposerPrimitive.Unstable_TriggerPopover.Directive
          formatter={directive.formatter ?? unstable_defaultDirectiveFormatter}
          onInserted={directive.onInserted}
        />
      ) : action ? (
        <ComposerPrimitive.Unstable_TriggerPopover.Action
          formatter={action.formatter ?? unstable_defaultDirectiveFormatter}
          onExecute={action.onExecute}
          removeOnExecute={action.removeOnExecute}
        />
      ) : null}

      <Categories
        iconMap={iconMap}
        fallbackIcon={fallbackIcon}
        emptyLabel={emptyCategoriesLabel}
      />
      <Items
        iconMap={iconMap}
        fallbackIcon={fallbackIcon}
        backLabel={backLabel}
        emptyLabel={emptyItemsLabel}
        loadingLabel={loadingLabel}
      />
    </ComposerPrimitive.Unstable_TriggerPopover>
  );
};

export const ComposerTriggerPopover = memo(ComposerTriggerPopoverImpl);
