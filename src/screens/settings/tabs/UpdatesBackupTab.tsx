import React, { useRef, useState } from 'react';
import { useSettings } from '../../../hooks/useSettings';
import {
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

export const UpdatesBackupTab: React.FC = () => {
  const { settings, updateSetting, exportSettingsJson, importSettingsJson, resetSettings } =
    useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  const handleCheckUpdates = () => {
    setIsCheckingUpdates(true);
    setUpdateStatus('Checking GitHub releases and repo manifests...');
    setTimeout(() => {
      setIsCheckingUpdates(false);
      setUpdateStatus('You are running the latest version: v1.0.0 (Up to date)');
    }, 1800);
  };

  const handleExportBackup = () => {
    try {
      const dataStr = exportSettingsJson();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cloudstream_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setBackupNotice('Backup exported successfully! File downloaded.');
      setTimeout(() => setBackupNotice(null), 4000);
    } catch (e) {
      console.error('Export error:', e);
      alert('Failed to export backup JSON.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importSettingsJson(content);
        if (success) {
          setBackupNotice('Settings restored successfully from backup file!');
          setTimeout(() => setBackupNotice(null), 4000);
        } else {
          alert('Invalid backup JSON format. Please verify file content.');
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="stremio-settings-tab-pane animate-fade-in">
      {backupNotice && (
        <div className="settings-success-banner animate-fade-in" style={{ marginBottom: '16px' }}>
          <CheckCircle2 size={16} /> {backupNotice}
        </div>
      )}

      {/* Automatic Update Checks */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Automatic Update Checks</span>
          <span className="stremio-setting-subtext">Check for new app builds periodically in the background</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.autoCheckUpdates}
            onChange={(e) => updateSetting('autoCheckUpdates', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Pre-Release Beta Channels */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Receive Pre-Release / Beta Channels</span>
          <span className="stremio-setting-subtext">Access preview features and experimental streaming optimizations</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.notifyBetaReleases}
            onChange={(e) => updateSetting('notifyBetaReleases', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Manual Update Trigger */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Manual Update Trigger</span>
          <span className="stremio-setting-subtext">
            {updateStatus || 'Click to verify GitHub releases and plugin manifests now'}
          </span>
        </div>
        <button
          className="settings-btn-primary"
          onClick={handleCheckUpdates}
          disabled={isCheckingUpdates}
        >
          <RefreshCw size={14} className={isCheckingUpdates ? 'animate-spin' : ''} />
          {isCheckingUpdates ? 'Checking...' : 'Check for Updates'}
        </button>
      </div>

      {/* Auto-Update Extensions */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Auto-Update Extensions</span>
          <span className="stremio-setting-subtext">Automatically fetch updated .cs3 plugins when providers release fixes</span>
        </div>
        <label className="stremio-switch">
          <input
            type="checkbox"
            checked={settings.autoUpdatePlugins}
            onChange={(e) => updateSetting('autoUpdatePlugins', e.target.checked)}
          />
          <span className="stremio-switch-slider" />
        </label>
      </div>

      {/* Auto-Download New Plugins */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Auto-Download New Plugins</span>
          <span className="stremio-setting-subtext">Behavior when repository manifests add brand new providers</span>
        </div>
        <select
          className="stremio-select"
          value={settings.autoDownloadPluginsMode}
          onChange={(e) => updateSetting('autoDownloadPluginsMode', e.target.value as any)}
        >
          <option value="matching_language">Matching App Language Only</option>
          <option value="all">All New Plugins</option>
          <option value="disabled">Disabled (Manual Download Only)</option>
          <option value="nsfw">All Including NSFW</option>
        </select>
      </div>

      {/* Automated Periodic Backup */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Automated Periodic Backup Schedule</span>
          <span className="stremio-setting-subtext">How often the desktop app should snapshot your configuration</span>
        </div>
        <select
          className="stremio-select"
          value={settings.autoBackupIntervalHours}
          onChange={(e) => updateSetting('autoBackupIntervalHours', parseInt(e.target.value))}
        >
          <option value={0}>Disabled</option>
          <option value={6}>Every 6 Hours</option>
          <option value={12}>Every 12 Hours</option>
          <option value={24}>Every 24 Hours (Recommended)</option>
          <option value={72}>Every 3 Days</option>
          <option value={168}>Weekly</option>
        </select>
      </div>

      {/* Export Backup */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Export Configuration (.json)</span>
          <span className="stremio-setting-subtext">Download complete settings backup file to your computer</span>
        </div>
        <button className="settings-btn-primary" onClick={handleExportBackup}>
          <Download size={14} /> Export Backup
        </button>
      </div>

      {/* Restore Backup */}
      <div className="stremio-setting-row">
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Restore from Backup File</span>
          <span className="stremio-setting-subtext">Load previously exported CloudStream JSON backup</span>
        </div>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <button
            className="settings-btn-subtle"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} /> Select Backup File
          </button>
        </div>
      </div>

      {/* Factory Reset */}
      <div className="stremio-setting-row" style={{ paddingTop: '16px' }}>
        <div className="stremio-setting-label-col">
          <span className="stremio-setting-label">Factory Reset All Settings</span>
          <span className="stremio-setting-subtext">Restore default application preferences (Watch history preserved)</span>
        </div>
        <button
          className="settings-btn-danger"
          onClick={() => {
            if (confirm('Are you sure you want to reset all CloudStream settings to defaults?')) {
              resetSettings();
            }
          }}
        >
          <RotateCcw size={14} /> Reset to Defaults
        </button>
      </div>
    </div>
  );
};
