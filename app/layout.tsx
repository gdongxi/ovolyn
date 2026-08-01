import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import "./globals.css";

// Self-hosted at build time — the wordmark's face, used for display type.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Ovolyn — the autonomous bank for AI agents",
  description: "Deposit, earn, govern and spend — an account built for an autonomous depositor, on Arc.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body>
        <header className="topbar">
          <a className="brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark.svg" alt="" className="mark" />
            OVOLYN
          </a>
          <div className="topright">
            <a className="navlink" href="/console">Console</a>
            <a className="navlink" href="/ledger">Ledger</a>
            <a className="navlink" href="/account">Account</a>
            <span className="net">ARC TESTNET · eip155:5042002</span>
          </div>
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
