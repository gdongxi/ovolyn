import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ovolyn — CFO Console",
  description: "The autonomous bank for AI agents, built on Arc.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark.svg" alt="" className="mark" />
            OVOLYN
          </div>
          <div className="topright">
            <a className="navlink" href="/account">Account</a>
            <span className="net">ARC TESTNET · eip155:5042002</span>
          </div>
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
