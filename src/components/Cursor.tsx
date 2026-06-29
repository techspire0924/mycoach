import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function Cursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mx = -200, my = -200;
    let clicking = false;
    let raf: number;
    const el = ref.current!;

    function onMove(e: MouseEvent) { mx = e.clientX; my = e.clientY; el.style.opacity = "1"; }

    function onOver(e: MouseEvent) {
      const hit = (e.target as HTMLElement).closest(
        "button, a, input, select, textarea, label, [role='button'], .nav-item, .goal-card, .inbox-item"
      );
      el.classList.toggle("hover", !!hit);
    }

    function onDown() { clicking = true;  el.classList.add("click"); }
    function onUp()   { clicking = false; el.classList.remove("click"); }
    function onLeave() { el.style.opacity = "0"; }

    function tick() {
      el.style.transform = `translate(${mx - 6}px, ${my - 2 + (clicking ? 2 : 0)}px)`;
      raf = requestAnimationFrame(tick);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup",   onUp);
    document.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup",   onUp);
      document.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return createPortal(
    <div ref={ref} className="cursor-emoji" style={{ opacity: 0 }}>👆</div>,
    document.body
  );
}
