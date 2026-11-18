import type { SVGProps } from "react";
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: string }) {
  const shapes: Record<string, React.ReactNode> = {
    next: <><path d="m5 4 11 8-11 8z"/><path d="M20 4v16"/></>,
    play: <path d="m7 4 13 8-13 8z"/>,
    pause: <><path d="M8 4v16M16 4v16"/></>,
    reset: <><path d="M4 9a8 8 0 1 1 0 6M4 3v6h6"/></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    arrow: <><path d="M3 12h18m-6-6 6 6-6 6"/></>,
    shield: <><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6z"/><path d="m8 12 3 3 5-6"/></>,
    network: <><rect x="9" y="2" width="6" height="6"/><rect x="2" y="16" width="6" height="6"/><rect x="16" y="16" width="6" height="6"/><path d="M12 8v4M5 16v-4h14v4"/></>,
    alert: <><path d="m12 3 10 18H2zM12 9v5m0 3v1"/></>,
    cross: <path d="m6 6 12 12M18 6 6 18"/>,
    check: <path d="m4 12 5 5L20 6"/>,
    unknown: <><path d="M9 8a3 3 0 1 1 4 3c-1 0-1 2-1 3m0 3v1"/><circle cx="12" cy="12" r="10"/></>
  };
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden="true" {...props}>{shapes[name] ?? shapes.network}</svg>;
}
