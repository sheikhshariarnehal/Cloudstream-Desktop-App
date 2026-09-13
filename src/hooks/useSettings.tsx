import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppSettings, DEFAULT_SETTINGS, SubtitleStyle, CustomSiteOverride } from '../types/settings';

const SETTINGS_STORAGE_KEY = 'cloudstream_desktop_settings_v1';

export interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updateSubtitleStyle: <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => void;
  addCustomSite: (site: Omit<CustomSiteOverride, 'id'>) => void;
  removeCustomSite: (id: string) => void;
  resetSettings: () => void;
  exportSettingsJson: () => string;
  importSettingsJson: (jsonString: string) => boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          subtitles: {
            ...DEFAULT_SETTINGS.subtitles,
            ...(parsed.subtitles || {}),
          },
          showCardBadges: {
            ...DEFAULT_SETTINGS.showCardBadges,
            ...(parsed.showCardBadges || {}),
          },
          showPlayerInfoChips: {
            ...DEFAULT_SETTINGS.showPlayerInfoChips,
            ...(parsed.showPlayerInfoChips || {}),
          },
          accounts: {
            ...DEFAULT_SETTINGS.accounts,
            ...(parsed.accounts || {}),
          },
        };
      }
    } catch (e) {
      console.error('Failed to load settings from storage:', e);
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.primaryAccent) {
      const paletteMap: Record<string, string> = {
        'Purple': '#7c3aed',
        'Cool Blue': '#3b82f6',
        'Cyan': '#06b6d4',
        'Emerald': '#10b981',
        'Green Apple': '#84cc16',
        'Dandelion Yellow': '#eab308',
        'Orange': '#f97316',
        'Fire Red': '#ef4444',
        'Rose': '#f43f5e',
        'Carnation Pink': '#ec4899',
        'Lavender Dreams': '#a855f7',
        'Maroon': '#991b1b',
        'Navy Blue': '#1e3a8a',
        'Silver Grey': '#94a3b8',
      };
      const hex = paletteMap[settings.primaryAccent] || '#7c3aed';
      root.style.setProperty('--stremio-purple', hex);
      root.style.setProperty('--primary', hex);
    }

    if (settings.theme === 'amoled') {
      root.style.setProperty('--primary-background-color', '#000000');
      root.style.setProperty('--secondary-background-color', '#050508');
      root.style.setProperty('--stremio-bg', '#000000');
    } else if (settings.theme === 'dracula') {
      root.style.setProperty('--primary-background-color', '#282a36');
      root.style.setProperty('--secondary-background-color', '#1e1f29');
      root.style.setProperty('--stremio-bg', '#282a36');
    } else if (settings.theme === 'lavender') {
      root.style.setProperty('--primary-background-color', '#120f24');
      root.style.setProperty('--secondary-background-color', '#1d173d');
      root.style.setProperty('--stremio-bg', '#120f24');
    } else if (settings.theme === 'silent_blue') {
      root.style.setProperty('--primary-background-color', '#0a1128');
      root.style.setProperty('--secondary-background-color', '#001e3d');
      root.style.setProperty('--stremio-bg', '#0a1128');
    } else {
      root.style.setProperty('--primary-background-color', '#0C0B12');
      root.style.setProperty('--secondary-background-color', '#19173A');
      root.style.setProperty('--stremio-bg', '#0C0B12');
    }
  }, [settings.theme, settings.primaryAccent]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const updateSubtitleStyle = useCallback(<K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => {
    setSettings((prev) => ({
      ...prev,
      subtitles: {
        ...prev.subtitles,
        [key]: value,
      },
    }));
  }, []);

  const addCustomSite = useCallback((site: Omit<CustomSiteOverride, 'id'>) => {
    const newSite: CustomSiteOverride = {
      ...site,
      id: 'site_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    };
    setSettings((prev) => ({
      ...prev,
      customSites: [...prev.customSites, newSite],
    }));
  }, []);

  const removeCustomSite = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      customSites: prev.customSites.filter((s) => s.id !== id),
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const exportSettingsJson = useCallback((): string => {
    return JSON.stringify(settings, null, 2);
  }, [settings]);

  const importSettingsJson = useCallback((jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      if (typeof parsed !== 'object' || parsed === null) return false;
      setSettings({
        ...DEFAULT_SETTINGS,
        ...parsed,
        subtitles: {
          ...DEFAULT_SETTINGS.subtitles,
          ...(parsed.subtitles || {}),
        },
      });
      return true;
    } catch (e) {
      console.error('Failed to import settings:', e);
      return false;
    }
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        updateSubtitleStyle,
        addCustomSite,
        removeCustomSite,
        resetSettings,
        exportSettingsJson,
        importSettingsJson,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
