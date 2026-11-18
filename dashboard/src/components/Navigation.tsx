"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icons";
export default function Navigation() {
  const pathname = usePathname();
  return <header className="topbar">
    <Link className="wordmark" href="/" aria-label="IDS Research home"><Icon name="network"/> IDS <span>Research</span><span className="brand-square"/></Link>
    <nav aria-label="Main navigation">
      <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>Replay</Link>
      <Link href="/results" aria-current={pathname === "/results" ? "page" : undefined}>Research Results</Link>
    </nav>
    <div className="university"><span className="uj-mark">UJ</span><span>University of<br/>Johannesburg</span></div>
  </header>;
}
