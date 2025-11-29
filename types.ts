export enum AppLanguage {
  ENGLISH = 'en',
  HINDI = 'hi',
}

export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

export interface AppState {
  language: AppLanguage;
  theme: ThemeMode;
  toggleLanguage: () => void;
  setTheme: (theme: ThemeMode) => void;
}

export interface PdfFile {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl?: string; // For images
}

export type ProcessingStatus = 'idle' | 'processing' | 'success' | 'error';
