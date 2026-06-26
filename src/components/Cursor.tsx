import { useEffect, useRef } from "react";

export default function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mx = -200, my = -200;
    let rx = -200, ry = -200;
    let raf: number;

    const dot  = dotRef.current!;
    const ring = ringRef.current!;

    function onMove(e: MouseEvent) {
      mx = e.clientX;
      my = e.clientY;
    }

    function onOver(e: MouseEvent) {
      const el = (e.target as HTMLElement).closest(
        "button, a, input, select, textarea, label, [role='button'], .nav-item, .goal-card, .inbox-item, .triage-btn"
      );
      dot.classList.toggle("hover", !!el);
      ring.classList.toggle("hover", !!el);
    }

    function onDown() { dot.classList.add("click"); ring.classList.add("click"); }
    function onUp()   { dot.classList.remove("click"); ring.classList.remove("click"); }

    function tick() {
      dot.style.transform  = `translate(${mx}px, ${my}px)`;
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      raf = requestAnimationFrame(tick);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup",   onUp);
    raf = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup",   onUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={dotRef}  className="cursor-dot"  />
      <div ref={ringRef} className="cursor-ring" />
    </>
  );
}
