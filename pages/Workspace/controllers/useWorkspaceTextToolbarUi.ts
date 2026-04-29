import { useEffect, useState } from "react";
import type { CanvasElement } from "../../../types";

type PopoverPosition = {
  x: number;
  y: number;
} | null;

type UseWorkspaceTextToolbarUiArgs = {
  fontTriggerRef: React.RefObject<HTMLButtonElement | null>;
  weightTriggerRef: React.RefObject<HTMLButtonElement | null>;
  textSettingsTriggerRef: React.RefObject<HTMLButtonElement | null>;
  elements: CanvasElement[];
  selectedElementId: string | null;
  zoom: number;
  pan: { x: number; y: number };
};

export const useWorkspaceTextToolbarUi = ({
  fontTriggerRef,
  weightTriggerRef,
  textSettingsTriggerRef,
  elements,
  selectedElementId,
  zoom,
  pan,
}: UseWorkspaceTextToolbarUiArgs) => {
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showWeightPicker, setShowWeightPicker] = useState(false);
  const [fontPickerPos, setFontPickerPos] = useState<PopoverPosition>(null);
  const [weightPickerPos, setWeightPickerPos] = useState<PopoverPosition>(null);
  const [showTextSettings, setShowTextSettings] = useState(false);
  const [textSettingsPos, setTextSettingsPos] = useState<PopoverPosition>(null);

  const getPopoverPosition = (
    trigger: HTMLElement,
    panelWidth: number,
    estimatedHeight: number,
  ) => {
    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const viewportPadding = 8;
    let x = rect.left;
    let y = rect.bottom + gap;

    if (x + panelWidth > window.innerWidth - viewportPadding) {
      x = window.innerWidth - viewportPadding - panelWidth;
    }
    if (x < viewportPadding) x = viewportPadding;

    if (y + estimatedHeight > window.innerHeight - viewportPadding) {
      y = rect.top - gap - estimatedHeight;
    }
    if (y < viewportPadding) y = viewportPadding;

    return { x: Math.round(x), y: Math.round(y) };
  };

  const toggleFontPicker = () => {
    if (showFontPicker) {
      setShowFontPicker(false);
      return;
    }
    if (!fontTriggerRef.current) return;
    setShowWeightPicker(false);
    setFontPickerPos(getPopoverPosition(fontTriggerRef.current, 192, 260));
    setShowFontPicker(true);
  };

  const toggleWeightPicker = () => {
    if (showWeightPicker) {
      setShowWeightPicker(false);
      return;
    }
    if (!weightTriggerRef.current) return;
    setShowFontPicker(false);
    setWeightPickerPos(getPopoverPosition(weightTriggerRef.current, 128, 210));
    setShowWeightPicker(true);
  };

  const toggleTextSettings = () => {
    if (showTextSettings) {
      setShowTextSettings(false);
      return;
    }
    if (!textSettingsTriggerRef.current) return;
    setShowFontPicker(false);
    setShowWeightPicker(false);
    setTextSettingsPos(
      getPopoverPosition(textSettingsTriggerRef.current, 208, 160),
    );
    setShowTextSettings(true);
  };

  useEffect(() => {
    if (!showFontPicker) return;
    const selected = selectedElementId
      ? elements.find((element) => element.id === selectedElementId)
      : null;
    if (!selected || selected.type !== "text") {
      setShowFontPicker(false);
    }
  }, [showFontPicker, selectedElementId, elements]);

  useEffect(() => {
    if (!showWeightPicker) return;
    const selected = selectedElementId
      ? elements.find((element) => element.id === selectedElementId)
      : null;
    if (!selected || selected.type !== "text") {
      setShowWeightPicker(false);
    }
  }, [showWeightPicker, selectedElementId, elements]);

  useEffect(() => {
    if (!showFontPicker && !showWeightPicker) return;
    const syncPopoverPosition = () => {
      if (showFontPicker && fontTriggerRef.current) {
        setFontPickerPos(getPopoverPosition(fontTriggerRef.current, 192, 260));
      }
      if (showWeightPicker && weightTriggerRef.current) {
        setWeightPickerPos(
          getPopoverPosition(weightTriggerRef.current, 128, 210),
        );
      }
    };

    syncPopoverPosition();
    window.addEventListener("resize", syncPopoverPosition);
    window.addEventListener("scroll", syncPopoverPosition, true);
    return () => {
      window.removeEventListener("resize", syncPopoverPosition);
      window.removeEventListener("scroll", syncPopoverPosition, true);
    };
  }, [showFontPicker, showWeightPicker, zoom, pan, selectedElementId]);

  return {
    showFontPicker,
    setShowFontPicker,
    showWeightPicker,
    setShowWeightPicker,
    fontPickerPos,
    setFontPickerPos,
    weightPickerPos,
    setWeightPickerPos,
    showTextSettings,
    setShowTextSettings,
    textSettingsPos,
    setTextSettingsPos,
    getPopoverPosition,
    toggleFontPicker,
    toggleWeightPicker,
    toggleTextSettings,
  };
};
