import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ovolyn — CFO Console",
  description: "The autonomous bank for AI agents, built on Arc.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="brand">OVOLYN</div>
          <div className="net">ARC TESTNET · eip155:5042002</div>
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
