import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Buffer } from 'buffer';
import DrawbridgeClient from '@didcid/gatekeeper/drawbridge';
import Keymaster from '@didcid/keymaster';
import type { StoredWallet } from '@didcid/keymaster';
import CipherWeb from '@didcid/cipher';
import WalletWeb from '@didcid/keymaster/wallet/web';
import {
  clearSessionPassphrase,
  getSessionPassphrase,
  setSessionPassphrase,
} from '../utils/sessionPassphrase';

// ── Config ──────────────────────────────────────────────────────────────────
const GATEKEEPER_KEY = 'spellweb-gatekeeper-url';
export const DEFAULT_GATEKEEPER_URL = 'http://flaxlap.local:4224';
export const WEAVER_VAULT_ALIAS = 'spellweb-weaver-vault';

// Module-level singletons — one gatekeeper connection and cipher for the app lifetime
const gatekeeper = new DrawbridgeClient();
// Drawbridge JSON-encodes plain-text responses, wrapping returned CIDs in quotes.
// Strip outer quotes so vault item CIDs are stored as bare strings.
const _addText = gatekeeper.addText.bind(gatekeeper);
gatekeeper.addText = async (data: string) => (await _addText(data)).replace(/^"|"$/g, '');
const cipher = new CipherWeb();

// ── Types ────────────────────────────────────────────────────────────────────
export type WalletState = 'checking' | 'no-wallet' | 'locked' | 'unlocked';

interface KeymasterContextValue {
  walletState: WalletState;
  keymaster: Keymaster | null;
  mageDid: string | null;
  isGatekeeperConnected: boolean;
  gatekeeperUrl: string;
  connectWallet: () => void;
  disconnect: () => void;
  setGatekeeperUrl: (url: string) => void;
  refreshMageId: () => Promise<void>;
  exportWallet: () => Promise<void>;
  importWallet: (walletData: StoredWallet) => Promise<void>;
  saveToWeaverVault: (itemName: string, content: string) => Promise<void>;
  listWeaverVault: () => Promise<Record<string, unknown>>;
  deleteWeaverVaultItem: (itemName: string) => Promise<void>;
}

const KeymasterContext = createContext<KeymasterContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────
export function KeymasterProvider({ children }: { children: ReactNode }) {
  const [walletState, setWalletState] = useState<WalletState>('checking');
  const [showModal, setShowModal] = useState(false);
  const [isGatekeeperConnected, setIsGatekeeperConnected] = useState(false);
  const [gatekeeperUrl, setGatekeeperUrlState] = useState(
    localStorage.getItem(GATEKEEPER_KEY) ?? DEFAULT_GATEKEEPER_URL,
  );
  const [mageDid, setMageDid] = useState<string | null>(null);

  // Modal form state
  const [modalTab, setModalTab] = useState<'unlock' | 'import'>('unlock');
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirm, setPassphraseConfirm] = useState('');
  const [passphraseError, setPassphraseError] = useState('');

  // Keymaster singleton — ref so mutations don't trigger re-renders; refreshFlag drives them
  const keymasterRef = useRef<Keymaster | null>(null);
  const [refreshFlag, setRefreshFlag] = useState(0);

  // ── Gatekeeper connection ────────────────────────────────────────────────
  useEffect(() => {
    async function connect() {
      try {
        localStorage.setItem(GATEKEEPER_KEY, gatekeeperUrl);
        await gatekeeper.connect({ url: gatekeeperUrl });
        setIsGatekeeperConnected(true);
      } catch {
        setIsGatekeeperConnected(false);
      }
    }
    connect();
  }, [gatekeeperUrl]);

  // ── Wallet initialisation (runs once on mount) ───────────────────────────
  useEffect(() => {
    async function init() {
      const walletWeb = new WalletWeb();
      const walletData = await walletWeb.loadWallet();

      if (!walletData) {
        setWalletState('no-wallet');
        return;
      }

      const cached = getSessionPassphrase();
      if (cached) {
        const ok = await doUnlock(cached, false);
        if (ok) return;
        clearSessionPassphrase();
      }

      setWalletState('locked');
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core unlock / create ─────────────────────────────────────────────────
  async function doUnlock(pass: string, isNew: boolean): Promise<boolean> {
    const walletWeb = new WalletWeb();
    const instance = new Keymaster({ gatekeeper, wallet: walletWeb, cipher, passphrase: pass });

    try {
      if (isNew) {
        await instance.newWallet(undefined, true);
        await instance.recoverWallet();
      } else {
        await instance.loadWallet();
      }
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? err);
      setPassphraseError(msg.includes('Incorrect') ? 'Incorrect passphrase' : msg);
      return false;
    }

    keymasterRef.current = instance;
    setSessionPassphrase(pass);
    setWalletState('unlocked');
    setShowModal(false);
    setPassphrase('');
    setPassphraseConfirm('');
    setPassphraseError('');
    setRefreshFlag(n => n + 1);

    await doRefreshMageId(instance);
    return true;
  }

  // ── Mage DID resolution / creation ──────────────────────────────────────
  async function doRefreshMageId(km: Keymaster): Promise<void> {
    try {
      const ids = await km.listIds();
      const idList: string[] = Array.isArray(ids)
        ? ids
        : ids
          ? Object.keys(ids as Record<string, string>)
          : [];

      if (idList.length === 0) {
        // Auto-provision the Mage's first identity
        try {
          await km.createId('mage', { registry: 'hyperswarm' });
          const updated = await km.listIds();
          const list: string[] = Array.isArray(updated) ? updated : Object.keys(updated ?? {});
          if (list.length > 0) {
            const doc = await km.resolveDID(list[0]);
            setMageDid((doc as { didDocument?: { id?: string } })?.didDocument?.id ?? null);
          }
        } catch (err) {
          console.error('[keymaster] createId failed:', err);
          setMageDid(null);
        }
        return;
      }

      const doc = await km.resolveDID(idList[0]);
      setMageDid((doc as { didDocument?: { id?: string } })?.didDocument?.id ?? null);
    } catch (err) {
      console.error('[keymaster] refreshMageId failed:', err);
      setMageDid(null);
    }
  }

  // ── Passphrase submit handler ────────────────────────────────────────────
  const handlePassphraseSubmit = useCallback(async () => {
    setPassphraseError('');
    if (!passphrase.trim()) {
      setPassphraseError('Passphrase is required');
      return;
    }
    if (walletState === 'no-wallet' && passphrase !== passphraseConfirm) {
      setPassphraseError('Passphrases do not match');
      return;
    }
    await doUnlock(passphrase, walletState === 'no-wallet');
  }, [passphrase, passphraseConfirm, walletState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Import / Export ──────────────────────────────────────────────────────
  async function exportWallet(): Promise<void> {
    if (!keymasterRef.current) return;
    const enc = await keymasterRef.current.exportEncryptedWallet();
    const date = new Date().toISOString().slice(0, 10);
    const shortDid = mageDid ? mageDid.slice(-8) : 'wallet';
    const filename = `archon-wallet-${shortDid}-${date}.json`;
    const blob = new Blob([JSON.stringify(enc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function importWallet(walletData: StoredWallet): Promise<void> {
    const walletWeb = new WalletWeb();
    await walletWeb.saveWallet(walletData, true);
    setPassphraseError('');
    setPassphrase('');
    setPassphraseConfirm('');
    setWalletState('locked');
    setModalTab('unlock');
    setShowModal(true);
  }

  // ── Weaver Vault ─────────────────────────────────────────────────────────
  async function ensureWeaverVault(km: Keymaster): Promise<string> {
    let vaultId = await km.getAlias(WEAVER_VAULT_ALIAS);
    if (!vaultId) {
      vaultId = await km.createVault();
      await km.addAlias(WEAVER_VAULT_ALIAS, vaultId);
    }
    return vaultId;
  }

  async function saveToWeaverVault(itemName: string, content: string): Promise<void> {
    const km = keymasterRef.current;
    if (!km) throw new Error('Wallet not unlocked');
    const vaultId = await ensureWeaverVault(km);
    try { await km.removeVaultItem(vaultId, itemName); } catch { /* not yet present */ }
    await km.addVaultItem(vaultId, itemName, Buffer.from(content));
  }

  async function listWeaverVault(): Promise<Record<string, unknown>> {
    const km = keymasterRef.current;
    if (!km) return {};
    const vaultId = await km.getAlias(WEAVER_VAULT_ALIAS);
    if (!vaultId) return {};
    return (await km.listVaultItems(vaultId)) as Record<string, unknown>;
  }

  async function deleteWeaverVaultItem(itemName: string): Promise<void> {
    const km = keymasterRef.current;
    if (!km) throw new Error('Wallet not unlocked');
    const vaultId = await km.getAlias(WEAVER_VAULT_ALIAS);
    if (!vaultId) throw new Error('No Weaver vault found');
    await km.removeVaultItem(vaultId, itemName);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function connectWallet() {
    setPassphraseError('');
    setPassphrase('');
    setPassphraseConfirm('');
    setShowModal(true);
  }

  function disconnect() {
    keymasterRef.current = null;
    clearSessionPassphrase();
    setMageDid(null);
    setRefreshFlag(n => n + 1);
    setWalletState('locked');
  }

  const refreshMageId = useCallback(async () => {
    if (keymasterRef.current) {
      await doRefreshMageId(keymasterRef.current);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // refreshFlag drives re-reads of keymasterRef.current into context value
  void refreshFlag;

  const value: KeymasterContextValue = {
    walletState,
    keymaster: keymasterRef.current,
    mageDid,
    isGatekeeperConnected,
    gatekeeperUrl,
    connectWallet,
    disconnect,
    setGatekeeperUrl: setGatekeeperUrlState,
    refreshMageId,
    exportWallet,
    importWallet,
    saveToWeaverVault,
    listWeaverVault,
    deleteWeaverVaultItem,
  };

  return (
    <KeymasterContext.Provider value={value}>
      {children}

      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-bg-panel border border-border rounded-xl p-6 w-80 space-y-4">
            <div className="text-center">
              <div className="text-3xl mb-2">✦</div>
              <h2 className="text-base font-semibold text-text-bright">Archon Wallet</h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-lg bg-bg-card border border-border">
              {(['unlock', 'import'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setModalTab(tab)}
                  className="flex-1 py-1.5 rounded text-xs font-mono capitalize transition-colors"
                  style={{
                    background: modalTab === tab ? 'var(--accent)' : 'transparent',
                    color: modalTab === tab ? '#000' : 'var(--text-dim)',
                  }}
                >
                  {tab === 'unlock' ? (walletState === 'no-wallet' ? 'Create' : 'Unlock') : 'Import'}
                </button>
              ))}
            </div>

            {modalTab === 'unlock' && (
              <div className="space-y-2">
                <p className="text-xs text-text-dim">
                  {walletState === 'no-wallet'
                    ? 'Set a passphrase to protect your Archon identity'
                    : 'Enter your passphrase to unlock the Mage wallet'}
                </p>
                <input
                  type="password"
                  placeholder="Passphrase"
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePassphraseSubmit()}
                  className="w-full px-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
                  autoFocus
                />
                {walletState === 'no-wallet' && (
                  <input
                    type="password"
                    placeholder="Confirm passphrase"
                    value={passphraseConfirm}
                    onChange={e => setPassphraseConfirm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePassphraseSubmit()}
                    className="w-full px-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
                  />
                )}
                {passphraseError && (
                  <p className="text-xs" style={{ color: 'var(--danger)' }}>{passphraseError}</p>
                )}
              </div>
            )}

            {modalTab === 'import' && (
              <div className="space-y-2">
                <p className="text-xs text-text-dim">
                  Import an encrypted Archon wallet JSON from keymaster or another device.
                </p>
                <label className="flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-lg text-xs text-text-dim font-mono cursor-pointer hover:border-accent hover:text-text-primary transition-colors">
                  📂 Choose wallet file
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const text = await file.text();
                        const data = JSON.parse(text) as StoredWallet;
                        await importWallet(data);
                      } catch {
                        setPassphraseError('Invalid wallet file');
                      }
                    }}
                  />
                </label>
                {passphraseError && (
                  <p className="text-xs" style={{ color: 'var(--danger)' }}>{passphraseError}</p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-text-dim hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              {modalTab === 'unlock' && (
                <button
                  onClick={handlePassphraseSubmit}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: 'var(--accent)', color: '#000' }}
                >
                  {walletState === 'no-wallet' ? 'Create' : 'Unlock'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </KeymasterContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useKeymaster(): KeymasterContextValue {
  const ctx = useContext(KeymasterContext);
  if (!ctx) throw new Error('useKeymaster must be used within KeymasterProvider');
  return ctx;
}
