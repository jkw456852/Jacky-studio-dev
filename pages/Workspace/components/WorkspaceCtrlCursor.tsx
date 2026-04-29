import React, { useEffect, useRef } from "react";

type WorkspaceCtrlCursorProps = {
  visible: boolean;
};

export const WorkspaceCtrlCursor: React.FC<WorkspaceCtrlCursorProps> = ({
  visible,
}) => {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const pointRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    if (!visible) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (cursorRef.current) {
        cursorRef.current.style.transform = "translate3d(-9999px, -9999px, 0)";
      }
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      pointRef.current = { x: event.clientX, y: event.clientY };
      if (rafRef.current) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const cursor = cursorRef.current;
        if (!cursor) return;
        const { x, y } = pointRef.current;
        cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={cursorRef}
      className="fixed pointer-events-none z-[99999] w-[24px] h-[24px] -ml-[12px] -mt-[12px] border-2 border-blue-500 rounded-full flex items-center justify-center transition-transform duration-75"
      style={{
        left: 0,
        top: 0,
        transform: "translate3d(-9999px, -9999px, 0)",
        background: "rgba(59, 130, 246, 0.1)",
        willChange: "transform",
      }}
    >
      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
    </div>
  );
};
