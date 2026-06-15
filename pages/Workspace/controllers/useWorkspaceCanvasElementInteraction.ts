import { useCallback, type MutableRefObject } from "react";
import type React from "react";
import { analyzeImageRegion } from "../../../services/gemini";
import { useAgentStore } from "../../../stores/agent.store";
import type { CanvasElement, InputBlock, Marker, WorkspaceInputFile } from "../../../types";
import { collectNodeDescendantIds } from "../workspaceNodeGraph";

type ToolType = "select" | "hand" | "mark" | "insert" | "shape" | "text" | "brush" | "eraser";
type CreationMode = "agent" | "image" | "video";

type UseWorkspaceCanvasElementInteractionOptions = {
  isSpacePressedRef: MutableRefObject<boolean>;
  activeTool: ToolType;
  creationMode: CreationMode;
  isPickingFromCanvas: boolean;
  elementById: Map<string, CanvasElement>;
  getElementSourceUrl: (el: CanvasElement) => string | undefined;
  setImageGenUploads: (files: File[]) => void;
  setIsPickingFromCanvas: (picking: boolean) => void;
  setSelectedElementId: (id: string | null) => void;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  textEditDraftRef: MutableRefObject<Record<string, string>>;
  pendingSelectAllTextIdRef: MutableRefObject<string | null>;
  setEditingTextId: (id: string | null) => void;
  setActiveTool: (tool: ToolType) => void;
  addTextAtClientPoint: (
    clientX: number,
    clientY: number,
    opts?: { enterEdit?: boolean; switchToSelect?: boolean },
  ) => void;
  dataURLtoFile: (dataUrl: string, filename: string) => File;
  showAssistant: boolean;
  setShowAssistant: (show: boolean) => void;
  markers: Marker[];
  markersRef: MutableRefObject<Marker[]>;
  setInputBlocks: (blocks: InputBlock[]) => void;
  setMarkersSynced: (
    nextMarkers: Marker[] | ((prev: Marker[]) => Marker[]),
  ) => void;
  updateMarkersAndSaveHistory: (nextMarkers: Marker[]) => void;
  insertInputFile: (file: File) => void;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  zoom: number;
  pan: { x: number; y: number };
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  pendingDragElementIdRef: MutableRefObject<string | null>;
  dragSelectionIdsRef: MutableRefObject<string[]>;
  pendingAltDragDuplicateRef: MutableRefObject<{
    anchorId: string;
    selectionIds: string[];
  } | null>;
  setIsDraggingElement: (dragging: boolean) => void;
  setDragStart: (point: { x: number; y: number }) => void;
  setElementStartPos: (point: { x: number; y: number }) => void;
  setElementsSynced: React.Dispatch<React.SetStateAction<CanvasElement[]>>;
  groupDragStartRef: MutableRefObject<Record<string, { x: number; y: number }>>;
  setIsResizing: (resizing: boolean) => void;
  setResizeHandle: (handle: string | null) => void;
  setResizeStart: React.Dispatch<
    React.SetStateAction<{
      x: number;
      y: number;
      width: number;
      height: number;
      left: number;
      top: number;
      fontSize: number;
    }>
  >;
};

export function useWorkspaceCanvasElementInteraction(
  options: UseWorkspaceCanvasElementInteractionOptions,
) {
  const {
    isSpacePressedRef,
    activeTool,
    creationMode,
    isPickingFromCanvas,
    elementById,
    getElementSourceUrl,
    setImageGenUploads,
    setIsPickingFromCanvas,
    setSelectedElementId,
    setSelectedElementIds,
    textEditDraftRef,
    pendingSelectAllTextIdRef,
    setEditingTextId,
    setActiveTool,
    addTextAtClientPoint,
    dataURLtoFile,
    showAssistant,
    setShowAssistant,
    markers,
    markersRef,
    setInputBlocks,
    setMarkersSynced,
    updateMarkersAndSaveHistory,
    insertInputFile,
    containerRef,
    zoom,
    pan,
    setZoom,
    setPan,
    selectedElementId,
    selectedElementIds,
    pendingDragElementIdRef,
    dragSelectionIdsRef,
    pendingAltDragDuplicateRef,
    setIsDraggingElement,
    setDragStart,
    setElementStartPos,
    setElementsSynced,
    groupDragStartRef,
    setIsResizing,
    setResizeHandle,
    setResizeStart,
  } = options;

  const cropImageRegion = useCallback(
    async (
      imageUrl: string,
      xPct: number,
      yPct: number,
      width: number = 200,
      height: number = 200,
    ): Promise<string | null> =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(null);
              return;
            }

            const sourceX = (xPct / 100) * img.naturalWidth - width / 2;
            const sourceY = (yPct / 100) * img.naturalHeight - height / 2;

            ctx.drawImage(
              img,
              sourceX,
              sourceY,
              width,
              height,
              0,
              0,
              width,
              height,
            );
            resolve(canvas.toDataURL("image/png"));
          } catch (error) {
            console.warn("cropImageRegion: canvas tainted or draw failed", error);
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
      }),
    [],
  );

  const isMarkableElement = useCallback(
    (element: CanvasElement | null | undefined) =>
      Boolean(
        element &&
          (element.type === "image" || element.type === "gen-image") &&
          element.url,
      ),
    [],
  );

  const handleMarkPlacement = useCallback(
    async (
      eventTarget: HTMLElement,
      elementId: string,
      clientX: number,
      clientY: number,
    ) => {
      const imgEl = eventTarget.querySelector("img");
      const rect = imgEl
        ? imgEl.getBoundingClientRect()
        : eventTarget.getBoundingClientRect();
      const x = Math.max(
        0,
        Math.min(100, ((clientX - rect.left) / rect.width) * 100),
      );
      const y = Math.max(
        0,
        Math.min(100, ((clientY - rect.top) / rect.height) * 100),
      );

      const newMarkerId = (Date.now() + Math.random()).toString();
      const el = elementById.get(elementId);
      let cropUrl: string | undefined;

      try {
        if (el && (el.type === "image" || el.type === "gen-image") && el.url) {
          const cropWidth = 300;
          const cropHeight = 300;
          const crop = await cropImageRegion(
            el.url,
            x,
            y,
            cropWidth,
            cropHeight,
          );
          if (crop) {
            cropUrl = crop;

            if (!showAssistant) {
              setShowAssistant(true);
              await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // [Jacky-Studio] marker 文件内容改为“带标记的完整原图”，避免下游把 300x300 裁切图当 sourceUrl
            let file: WorkspaceInputFile;
            try {
              const fullRes = await fetch(el.url);
              const fullBlob = await fullRes.blob();
              const annotatedBlob = await new Promise<Blob>((resolve) => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement("canvas");
                  canvas.width = Math.max(1, img.naturalWidth || el.width || 1024);
                  canvas.height = Math.max(1, img.naturalHeight || el.height || 1024);
                  const ctx = canvas.getContext("2d");
                  if (!ctx) {
                    resolve(fullBlob);
                    return;
                  }
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  const mx = (x / 100) * canvas.width;
                  const my = (y / 100) * canvas.height;
                  const ringRadius = Math.max(6, Math.min(canvas.width, canvas.height) * 0.01);
                  const dotRadius = Math.max(2, ringRadius * 0.22);

                  ctx.beginPath();
                  ctx.arc(mx, my, ringRadius, 0, Math.PI * 2);
                  ctx.strokeStyle = "rgba(255, 64, 64, 0.85)";
                  ctx.lineWidth = Math.max(1.5, ringRadius * 0.12);
                  ctx.stroke();

                  ctx.beginPath();
                  ctx.arc(mx, my, dotRadius, 0, Math.PI * 2);
                  ctx.fillStyle = "rgba(255, 64, 64, 0.88)";
                  ctx.fill();

                  canvas.toBlob((blob) => resolve(blob || fullBlob), "image/png");
                };
                img.onerror = () => resolve(fullBlob);
                img.src = URL.createObjectURL(fullBlob);
              });
              file = new File([annotatedBlob], `marker-annotated-${markers.length + 1}.png`, {
                type: "image/png",
              }) as WorkspaceInputFile;
              // [Jacky-Studio] 用原图天然尺寸记录 markerInfo，避免下游把画布缩放后的 1:1 当原图比例
              const fallbackWidth = el.width || 0;
              const fallbackHeight = el.height || 0;
              (file as any).__naturalMarkerImageWidth = await new Promise<number>((resolve) => {
                const probe = new Image();
                probe.onload = () => resolve(probe.naturalWidth || fallbackWidth);
                probe.onerror = () => resolve(fallbackWidth);
                probe.src = URL.createObjectURL(fullBlob);
              });
              (file as any).__naturalMarkerImageHeight = await new Promise<number>((resolve) => {
                const probe = new Image();
                probe.onload = () => resolve(probe.naturalHeight || fallbackHeight);
                probe.onerror = () => resolve(fallbackHeight);
                probe.src = URL.createObjectURL(fullBlob);
              });
            } catch {
              // 拉原图失败时退回裁切图，保证流程不挂
              file = dataURLtoFile(
                crop,
                `marker-${markers.length + 1}.png`,
              ) as WorkspaceInputFile;
            }
            file.markerId = newMarkerId;
            file.markerName = "Selection";
            file.markerInfo = {
              fullImageUrl: el.url,
              cropUrl: crop,
              normalizedX: x / 100,
              normalizedY: y / 100,
              x: (x / 100) * el.width - cropWidth / 2,
              y: (y / 100) * el.height - cropHeight / 2,
              width: cropWidth,
              height: cropHeight,
              imageWidth: (file as any).__naturalMarkerImageWidth || el.width,
              imageHeight: (file as any).__naturalMarkerImageHeight || el.height,
            };

            if (creationMode === "agent") {
              setTimeout(() => {
                insertInputFile(file);
              }, 150);
            }

            // [Jacky-Studio] 不再调 analyzeImageRegion 给 marker 取语义名
            // 新 mark 方案直接传完整原图 + 归一化坐标给多模态模型，由模型自己识别标记区域语义
          }
        }
      } catch (err) {
        console.warn("Mark crop failed, continuing with marker placement", err);
      }

      const newMarkers = [
        ...markersRef.current,
        { id: newMarkerId, x, y, elementId, cropUrl },
      ];
      updateMarkersAndSaveHistory(newMarkers);

      if (el && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const targetZoom = 100;
        const scale = targetZoom / 100;
        const markerCanvasX = el.x + (el.width * x) / 100;
        const markerCanvasY = el.y + (el.height * y) / 100;
        const targetPanX = containerRect.width / 2 - markerCanvasX * scale;
        const targetPanY = containerRect.height / 2 - markerCanvasY * scale;
        const startZoom = zoom;
        const startPanX = pan.x;
        const startPanY = pan.y;
        const duration = 400;
        const startTime = performance.now();

        const animate = (now: number) => {
          const elapsed = now - startTime;
          const t = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          setZoom(startZoom + (targetZoom - startZoom) * ease);
          setPan({
            x: startPanX + (targetPanX - startPanX) * ease,
            y: startPanY + (targetPanY - startPanY) * ease,
          });
          if (t < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    },
    [
      containerRef,
      creationMode,
      cropImageRegion,
      dataURLtoFile,
      elementById,
      insertInputFile,
      markers.length,
      markersRef,
      pan,
      setInputBlocks,
      setMarkersSynced,
      setPan,
      setShowAssistant,
      setZoom,
      showAssistant,
      updateMarkersAndSaveHistory,
      zoom,
    ],
  );

  const handleElementMouseDown = useCallback(
    async (e: React.MouseEvent, id: string) => {
      if (isSpacePressedRef.current || activeTool === "hand") return;
      pendingAltDragDuplicateRef.current = null;

      if (creationMode === "image" && isPickingFromCanvas) {
        const pickedEl = elementById.get(id);
        if (
          pickedEl &&
          (pickedEl.type === "image" || pickedEl.type === "gen-image") &&
          pickedEl.url
        ) {
          e.stopPropagation();
          e.preventDefault();
          try {
            const sourceUrl = getElementSourceUrl(pickedEl) || pickedEl.url;
            if (!sourceUrl) return;
            const resp = await fetch(sourceUrl);
            const blob = await resp.blob();
            const file = new File(
              [blob],
              `canvas-ref-${pickedEl.id.slice(-6)}.png`,
              { type: blob.type || "image/png" },
            );
            setImageGenUploads([file]);
          } catch (err) {
            console.warn("Pick image from canvas failed:", err);
          } finally {
            setIsPickingFromCanvas(false);
          }
          return;
        }
      }

      const elObj = elementById.get(id);
      if (elObj?.hasFreshGeneratedGlow) {
        setElementsSynced((currentElements) =>
          currentElements.map((element) =>
            element.id === id
              ? { ...element, hasFreshGeneratedGlow: false }
              : element,
          ),
        );
      }
      if (activeTool === "text") {
        e.stopPropagation();
        e.preventDefault();
        if (elObj?.isLocked) return;
        if (elObj?.type === "text") {
          setSelectedElementId(id);
          setSelectedElementIds((prev) =>
            prev.length === 1 && prev[0] === id ? prev : [id],
          );
          textEditDraftRef.current[id] = elObj.text || "";
          pendingSelectAllTextIdRef.current = id;
          setEditingTextId(id);
          setActiveTool("select");
        } else {
          addTextAtClientPoint(e.clientX, e.clientY, {
            enterEdit: true,
            switchToSelect: true,
          });
        }
        return;
      }

      if (elObj?.isLocked) return;
      e.stopPropagation();
      e.preventDefault();

      const modifierMarkRequested = e.ctrlKey || e.metaKey;
      if (
        activeTool === "mark" ||
        (modifierMarkRequested && isMarkableElement(elObj))
      ) {
        await handleMarkPlacement(
          e.currentTarget as HTMLElement,
          id,
          e.clientX,
          e.clientY,
        );
        return;
      }

      if (id !== selectedElementId) setEditingTextId(null);
      let effectiveId = id;
      const clickedEl = elementById.get(id);
      if (clickedEl?.groupId) {
        const parentGroup = elementById.get(clickedEl.groupId);
        if (parentGroup && !parentGroup.isCollapsed) {
          effectiveId = parentGroup.id;
        }
      }

      const isAlreadySelected =
        selectedElementId === effectiveId ||
        selectedElementIds.includes(effectiveId);
      const baseDragSelectionIds =
        selectedElementIds.length > 1 && selectedElementIds.includes(effectiveId)
          ? [...selectedElementIds]
          : [effectiveId];
      if (isAlreadySelected) {
        if (
          selectedElementIds.length > 1 &&
          selectedElementIds.includes(effectiveId)
        ) {
          setSelectedElementId(effectiveId);
        } else {
          setSelectedElementId(effectiveId);
          setSelectedElementIds((prev) =>
            prev.length === 1 && prev[0] === effectiveId ? prev : [effectiveId],
          );
        }
      }
      pendingDragElementIdRef.current = effectiveId;
      dragSelectionIdsRef.current = baseDragSelectionIds;
      pendingAltDragDuplicateRef.current = e.altKey
        ? {
            anchorId: effectiveId,
            selectionIds: baseDragSelectionIds,
          }
        : null;
      setIsDraggingElement(false);
      setDragStart({ x: e.clientX, y: e.clientY });
      const el = elementById.get(effectiveId);
      if (el) setElementStartPos({ x: el.x, y: el.y });

      let draggingIds =
        baseDragSelectionIds.length > 0 ? [...baseDragSelectionIds] : [effectiveId];
      const draggingIdSet = new Set(draggingIds);
      for (const did of [...draggingIds]) {
        const dEl = elementById.get(did);
        if (dEl?.type === "group" && dEl.children) {
          for (const cid of dEl.children) {
            if (!draggingIdSet.has(cid)) {
              draggingIds.push(cid);
              draggingIdSet.add(cid);
            }
          }
        }
      }
      for (const descendantId of collectNodeDescendantIds(
        Array.from(elementById.values()),
        draggingIds,
      )) {
        if (draggingIdSet.has(descendantId)) {
          continue;
        }
        draggingIds.push(descendantId);
        draggingIdSet.add(descendantId);
      }
      const startMap: Record<string, { x: number; y: number }> = {};
      for (const did of draggingIds) {
        const d = elementById.get(did);
        if (d) startMap[did] = { x: d.x, y: d.y };
      }
      groupDragStartRef.current = startMap;
    },
    [
      activeTool,
      addTextAtClientPoint,
      containerRef,
      creationMode,
      cropImageRegion,
      dataURLtoFile,
      elementById,
      getElementSourceUrl,
      groupDragStartRef,
      insertInputFile,
      isPickingFromCanvas,
      isSpacePressedRef,
      markers,
      markersRef,
      pan,
      pendingSelectAllTextIdRef,
      selectedElementId,
      selectedElementIds,
      dragSelectionIdsRef,
      pendingAltDragDuplicateRef,
      setActiveTool,
      setDragStart,
      setEditingTextId,
      setElementStartPos,
      setElementsSynced,
      setImageGenUploads,
      setInputBlocks,
      isMarkableElement,
      setIsDraggingElement,
      setIsPickingFromCanvas,
      setMarkersSynced,
      setPan,
      setSelectedElementId,
      setSelectedElementIds,
      setShowAssistant,
      setZoom,
      showAssistant,
      textEditDraftRef,
      updateMarkersAndSaveHistory,
      zoom,
    ],
  );

  const handleElementTouchStart = useCallback(
    async (e: React.TouchEvent, id: string) => {
      if (isSpacePressedRef.current || activeTool === "hand" || activeTool !== "mark") {
        return;
      }

      const touch = e.touches[0];
      if (!touch) {
        return;
      }

      const elObj = elementById.get(id);
      if (elObj?.isLocked || !isMarkableElement(elObj)) {
        return;
      }

      pendingAltDragDuplicateRef.current = null;
      e.stopPropagation();
      e.preventDefault();
      await handleMarkPlacement(
        e.currentTarget as HTMLElement,
        id,
        touch.clientX,
        touch.clientY,
      );
    },
    [
      activeTool,
      elementById,
      handleMarkPlacement,
      isMarkableElement,
      isSpacePressedRef,
      pendingAltDragDuplicateRef,
    ],
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, handle: string, elementId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const el = elementById.get(elementId);
      if (!el) return;

      const isLocked =
        el.isLocked ||
        (el.groupId ? elementById.get(el.groupId)?.isLocked : false);
      if (isLocked) return;

      setIsResizing(true);
      setResizeHandle(handle);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: el.width,
        height: el.height,
        left: el.x,
        top: el.y,
        fontSize: el.fontSize || 16,
      });
    },
    [elementById, setIsResizing, setResizeHandle, setResizeStart],
  );

  return {
    handleElementMouseDown,
    handleElementTouchStart,
    handleResizeStart,
  };
}
