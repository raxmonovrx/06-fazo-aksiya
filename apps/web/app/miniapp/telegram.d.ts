// Telegram WebApp SDK'ning bizga kerak qismi
interface TgWebApp {
  initData: string;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  close(): void;
  isVersionAtLeast(v: string): boolean;
  showScanQrPopup(params: { text?: string }, cb?: (text: string) => boolean | void): void;
  closeScanQrPopup(): void;
  showAlert(message: string, cb?: () => void): void;
  openTelegramLink(url: string): void;
  openLink(url: string): void;
  onEvent(event: string, cb: (...args: unknown[]) => void): void;
  offEvent(event: string, cb: (...args: unknown[]) => void): void;
  HapticFeedback?: {
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
  };
  MainButton: { setText(t: string): void; show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
}

interface Window {
  Telegram?: { WebApp: TgWebApp };
}
