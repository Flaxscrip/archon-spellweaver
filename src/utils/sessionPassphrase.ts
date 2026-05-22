let sessionPassphrase: string | null = null;

export function getSessionPassphrase(): string {
  return sessionPassphrase ?? '';
}

export function setSessionPassphrase(passphrase: string): void {
  sessionPassphrase = passphrase;
}

export function clearSessionPassphrase(): void {
  sessionPassphrase = null;
}
