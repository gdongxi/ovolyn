"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGES = [
  { href: "/console", label: "Console" },
  { href: "/treasury", label: "Treasury" },
  { href: "/market", label: "Market" },
  { href: "/ledger", label: "Ledger" },
  { href: "/agents", label: "Agents" },
];

export function Nav() {
  const path = usePathname();
  return (
    <div className="topright">
      <nav className="mainnav">
        {PAGES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className={`navlink ${path.startsWith(p.href) ? "is-active" : ""}`}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <span className="net">ARC TESTNET · eip155:5042002</span>
    </div>
  );
}
