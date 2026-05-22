import { useKeymaster } from '../contexts/KeymasterContext';
import { useState } from 'react';

function truncateDid(did: string): string {
  // did:cid:bafkreiXXXXXXXXXXXX… → show prefix + 10 chars
  const prefix = 'did:cid:';
  if (!did.startsWith(prefix)) return did.slice(0, 24) + '…';
  const suffix = did.slice(prefix.length);
  return `${prefix}${suffix.slice(0, 10)}…`;
}

export function MageIdentityPanel() {
  const { walletState, mageDid, isGatekeeperConnected, connectWallet, disconnect, exportWallet } =
    useKeymaster();
  const [exporting, setExporting] = useState(false);

  const gatekeeperDot = (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: isGatekeeperConnected ? 'var(--success)' : 'var(--warning)' }}
      title={isGatekeeperConnected ? 'Gatekeeper connected' : 'Gatekeeper offline'}
    />
  );

  if (walletState === 'checking') {
    return (
      <div className="flex items-center gap-2 text-xs text-text-dim font-mono">
        <span className="w-2 h-2 rounded-full bg-bg-card animate-pulse" />
        checking…
      </div>
    );
  }

  if (walletState === 'unlocked' && mageDid) {
    const handleExport = async () => {
      setExporting(true);
      try { await exportWallet(); } finally { setExporting(false); }
    };
    return (
      <div className="flex items-center gap-2">
        {gatekeeperDot}
        <span className="text-xs font-mono text-text-dim" title={mageDid}>
          {truncateDid(mageDid)}
        </span>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="text-xs text-text-dim hover:text-text-primary transition-colors leading-none"
          title="Export wallet"
        >
          {exporting ? '…' : '↓'}
        </button>
        <button
          onClick={disconnect}
          className="text-xs text-text-dim hover:text-text-primary transition-colors leading-none"
          title="Disconnect wallet"
        >
          ✕
        </button>
      </div>
    );
  }

  // no-wallet, locked, or unlocked-but-no-did
  return (
    <button
      onClick={connectWallet}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs text-text-dim hover:text-text-primary hover:border-accent transition-all font-mono"
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: 'var(--danger)' }}
      />
      {walletState === 'locked' ? 'Unlock Wallet' : 'Connect Wallet'}
    </button>
  );
}
