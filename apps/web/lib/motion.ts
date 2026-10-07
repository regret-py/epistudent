/** Quick horizontal shake for a rejected input; does nothing for reduced-motion users. */
export function shake(el: HTMLElement | null) {
  if (!el || typeof el.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }],
    { duration: 260, easing: "ease-out" },
  );
}
