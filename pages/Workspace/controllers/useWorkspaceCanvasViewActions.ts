import { useCallback, type MouseEvent, type MutableRefObject } from "react";
import type { CanvasElement } from "../../../types";
import { downloadFromUrls } from "../../../utils/download";
import { getCanvasViewportSize } from "../workspaceShared";

type UseWorkspaceCanvasViewActionsOptions = {
  elements: CanvasElement[];
  showAssistant: boolean;
  setPan: (pan: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  addElement: (
    type: "image" | "video",
    url: string,
    dims?: { width: number; height: number },
  ) => void;
  selectedElementId: string | null;
  setContextMenu: (menu: { x: number; y: number } | null) => void;
  getElementSourceUrl: (element: CanvasElement) => string | undefined;
  suppressNextContextMenuRef: MutableRefObject<boolean>;
};

const PASTE_MAX_DIM = 800;
const FIT_SCREEN_PADDING = 100;

export function useWorkspaceCanvasViewActions(
  options: UseWorkspaceCanvasViewActionsOptions,
) {
  const {
    elements,
    showAssistant,
    setPan,
    setZoom,
    addElement,
    selectedElementId,
    setContextMenu,
    getElementSourceUrl,
    suppressNextContextMenuRef,
  } = options;

  const fitToScreen = useCallback(() => {
    if (elements.length === 0) {
      setPan({ x: 0, y: 0 });
      setZoom(100);
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    elements.forEach((element) => {
      minX = Math.min(minX, element.x);
      minY = Math.min(minY, element.y);
      maxX = Math.max(maxX, element.x + element.width);
      maxY = Math.max(maxY, element.y + element.height);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const viewport = getCanvasViewportSize(showAssistant);
    const containerW = viewport.width;
    const containerH = viewport.height;
    if (contentWidth <= 0 || contentHeight <= 0) return;

    const zoomW = (containerW - FIT_SCREEN_PADDING * 2) / contentWidth;
    const zoomH = (containerH - FIT_SCREEN_PADDING * 2) / contentHeight;
    const newZoom = Math.min(zoomW, zoomH) * 100;
    const finalZoom = Math.min(Math.max(newZoom, 10), 200);
    const centerX = minX + contentWidth / 2;
    const centerY = minY + contentHeight / 2;
    const newPanX = containerW / 2 - centerX * (finalZoom / 100);
    const newPanY = containerH / 2 - centerY * (finalZoom / 100);

    setZoom(finalZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [elements, setPan, setZoom, showAssistant]);

  const handleManualPaste = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (
          !item.types.includes("image/png") &&
          !item.types.includes("image/jpeg")
        ) {
          continue;
        }

        const blob = await item.getType(
          item.types.find((type) => type.startsWith("image/"))!,
        );
        const result = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve((event.target?.result as string) || "");
          reader.onerror = () =>
            reject(reader.error || new Error("Clipboard read failed"));
          reader.readAsDataURL(blob);
        });

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const next = new Image();
          next.onload = () => resolve(next);
          next.onerror = () => reject(new Error("Clipboard image load failed"));
          next.src = result;
        });

        let width = img.width;
        let height = img.height;
        if (width > PASTE_MAX_DIM || height > PASTE_MAX_DIM) {
          const ratio = width / height;
          if (width > height) {
            width = PASTE_MAX_DIM;
            height = PASTE_MAX_DIM / ratio;
          } else {
            height = PASTE_MAX_DIM;
            width = PASTE_MAX_DIM * ratio;
          }
        }

        addElement("image", result, { width, height });
      }
    } catch (error) {
      console.error("Clipboard access failed", error);
    }
  }, [addElement]);

  const handleDownload = useCallback(async () => {
    if (!selectedElementId) return;
    const element = elements.find((item) => item.id === selectedElementId);
    if (!element || !element.url) return;

    const sourceUrl = getElementSourceUrl(element) || element.url;
    try {
      await downloadFromUrls(
        [sourceUrl, element.originalUrl, element.proxyUrl, element.url],
        `jk-image-${Date.now()}`,
      );
    } catch (error) {
      console.error("Canvas element download failed", error);
    }
    setContextMenu(null);
  }, [
    elements,
    getElementSourceUrl,
    selectedElementId,
    setContextMenu,
  ]);

  const handleContextMenu = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();

      if (suppressNextContextMenuRef.current) {
        suppressNextContextMenuRef.current = false;
        setContextMenu(null);
        return;
      }

      setContextMenu({ x: event.clientX, y: event.clientY });
    },
    [setContextMenu, suppressNextContextMenuRef],
  );

  return {
    fitToScreen,
    handleContextMenu,
    handleManualPaste,
    handleDownload,
  };
}
