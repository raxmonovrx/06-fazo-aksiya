// Telegram WebApp SDK'ning bizga kerak qismi (https://core.telegram.org/bots/webapps)
type TgColorKey = 'bg_color' | 'secondary_bg_color' | `#${string}`;

interface TgWebApp {
  initData: string;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  isExpanded: boolean;
  isVerticalSwipesEnabled?: boolean;
  ready(): void;
  expand(): void;
  close(): void;
  isVersionAtLeast(v: string): boolean;
  // 6.1+
  setHeaderColor(color: TgColorKey): void;
  setBackgroundColor(color: TgColorKey): void;
  // 7.10+
  setBottomBarColor?(color: TgColorKey | 'bottom_bar_bg_color'): void;
  // 6.2+
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  // 7.7+ — pastga tortib yopishni o'chiradi
  disableVerticalSwipes?(): void;
  enableVerticalSwipes?(): void;
  // 8.0+
  lockOrientation?(): void;
  requestFullscreen?(): void;
  exitFullscreen?(): void;
  isFullscreen?: boolean;
  showScanQrPopup(params: { text?: string }, cb?: (text: string) => boolean | void): void;
  closeScanQrPopup(): void;
  showAlert(message: string, cb?: () => void): void;
  openTelegramLink(url: string): void;
  openLink(url: string): void;
  onEvent(event: string, cb: (...args: unknown[]) => void): void;
  offEvent(event: string, cb: (...args: unknown[]) => void): void;
  HapticFeedback?: {
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    selectionChanged(): void;
  };
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  MainButton: {
    isVisible: boolean;
    setParams(p: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }): void;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
}

interface Window {
  Telegram?: {
    WebApp: TgWebApp;
    WebView?: { postEvent(event: string, callback: unknown, params?: Record<string, unknown>): void };
  };
}
