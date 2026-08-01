import { Guilloche } from "./engraving";

/**
 * The colophon. Bookends the dark statistics band above and carries the
 * reversed lockup — the one brand asset the site had not yet used.
 */
export function Footer() {
  return (
    <footer className="colophon">
      <Guilloche className="hero-plate" height={300} stroke="#f3f2f2" opacity={0.1} />
      <div className="colophon-inner">
        <div className="colophon-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lockup-reversed.svg" alt="Ovolyn" className="colophon-lockup" />
          <p>An account built for an autonomous depositor.</p>
        </div>

        <nav className="colophon-cols">
          <div>
            <div className="colophon-h">Bank</div>
            <a href="/bank">Bank</a>
            <a href="/market">Market</a>
            <a href="/ledger">Ledger</a>
            <a href="/agents">Agents</a>
          </div>
          <div>
            <div className="colophon-h">Build</div>
            <a href="https://github.com/gdongxi/ovolyn" target="_blank" rel="noreferrer">Repository</a>
            <a href="https://github.com/gdongxi/ovolyn/blob/main/docs/PRODUCT-SPEC.md" target="_blank" rel="noreferrer">Specification</a>
            <a href="https://github.com/gdongxi/ovolyn/blob/main/cli/ovolyn.mjs" target="_blank" rel="noreferrer">Agent CLI</a>
          </div>
          <div>
            <div className="colophon-h">Network</div>
            <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">Arc Testnet explorer</a>
            <span>eip155:5042002</span>
            <span>USDC is the gas token</span>
          </div>
        </nav>
      </div>

      <div className="colophon-rule">
        <div className="colophon-inner colophon-fine">
          <span>Ovolyn · Programmable Money Hackathon 2026</span>
          <span>Testnet figures. Every one of them verifiable on-chain.</span>
        </div>
      </div>
    </footer>
  );
}
