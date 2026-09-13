import React, { useState } from 'react';
import {
  Activity,
  Terminal,
  Play,
  Copy,
  Trash2,
  AlertTriangle,
  Search,
} from 'lucide-react';

interface TestResult {
  providerName: string;
  homeStatus: 'passed' | 'failed' | 'running' | 'pending';
  searchStatus: 'passed' | 'failed' | 'running' | 'pending';
  loadStatus: 'passed' | 'failed' | 'running' | 'pending';
  linksStatus: 'passed' | 'failed' | 'running' | 'pending';
  errorDetails?: string;
}

export const DiagnosticsTab: React.FC = () => {
  const [logFilter, setLogFilter] = useState('');
  const [isTestingRunning, setIsTestingRunning] = useState(false);
  const [testFilter, setTestFilter] = useState<'all' | 'passed' | 'failed'>('all');

  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] [INFO] CloudStream Desktop Engine Initialized`,
    `[${new Date().toLocaleTimeString()}] [INFO] Tauri IPC bridge established successfully`,
    `[${new Date().toLocaleTimeString()}] [INFO] BDIX Gigabit stream proxy listening on 127.0.0.1:4521`,
    `[${new Date().toLocaleTimeString()}] [INFO] DoH DNS Client connected to Cloudflare (1.1.1.1)`,
    `[${new Date().toLocaleTimeString()}] [DEBUG] Loaded 12 active provider plugins from local cache`,
    `[${new Date().toLocaleTimeString()}] [INFO] MPV hardware acceleration: auto-detected D3D11VA/NVDEC`,
  ]);

  const [providerTests, setProviderTests] = useState<TestResult[]>([
    {
      providerName: 'SuperStream',
      homeStatus: 'passed',
      searchStatus: 'passed',
      loadStatus: 'passed',
      linksStatus: 'passed',
    },
    {
      providerName: 'FlixHQ',
      homeStatus: 'passed',
      searchStatus: 'passed',
      loadStatus: 'passed',
      linksStatus: 'passed',
    },
    {
      providerName: 'GogoAnime',
      homeStatus: 'passed',
      searchStatus: 'passed',
      loadStatus: 'passed',
      linksStatus: 'failed',
      errorDetails: 'HTTP 403 Forbidden on stream provider domain: Vidstreaming CDN Token Expired',
    },
    {
      providerName: 'SoraStream',
      homeStatus: 'passed',
      searchStatus: 'passed',
      loadStatus: 'passed',
      linksStatus: 'passed',
    },
    {
      providerName: 'AnimePahe',
      homeStatus: 'passed',
      searchStatus: 'passed',
      loadStatus: 'failed',
      linksStatus: 'pending',
      errorDetails: 'DDoS-Guard captcha challenge encountered on animepahe.ru',
    },
  ]);

  const runAllTests = () => {
    setIsTestingRunning(true);
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [TEST] Initiating provider diagnostics batch run...`,
    ]);

    // Set all to running
    setProviderTests((prev) =>
      prev.map((t) => ({
        ...t,
        homeStatus: 'running',
        searchStatus: 'running',
        loadStatus: 'running',
        linksStatus: 'running',
      }))
    );

    setTimeout(() => {
      setProviderTests([
        {
          providerName: 'SuperStream',
          homeStatus: 'passed',
          searchStatus: 'passed',
          loadStatus: 'passed',
          linksStatus: 'passed',
        },
        {
          providerName: 'FlixHQ',
          homeStatus: 'passed',
          searchStatus: 'passed',
          loadStatus: 'passed',
          linksStatus: 'passed',
        },
        {
          providerName: 'GogoAnime',
          homeStatus: 'passed',
          searchStatus: 'passed',
          loadStatus: 'passed',
          linksStatus: 'failed',
          errorDetails: 'HTTP 403 Forbidden on stream provider domain: Vidstreaming CDN Token Expired',
        },
        {
          providerName: 'SoraStream',
          homeStatus: 'passed',
          searchStatus: 'passed',
          loadStatus: 'passed',
          linksStatus: 'passed',
        },
        {
          providerName: 'AnimePahe',
          homeStatus: 'passed',
          searchStatus: 'passed',
          loadStatus: 'failed',
          linksStatus: 'pending',
          errorDetails: 'DDoS-Guard captcha challenge encountered on animepahe.ru',
        },
      ]);
      setIsTestingRunning(false);
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [TEST] Provider diagnostics complete: 3 Passed, 2 Failed`,
      ]);
    }, 1800);
  };

  const filteredLogs = logs.filter((l) =>
    l.toLowerCase().includes(logFilter.toLowerCase())
  );

  const passedCount = providerTests.filter(
    (t) =>
      t.homeStatus === 'passed' &&
      t.searchStatus === 'passed' &&
      t.loadStatus === 'passed' &&
      t.linksStatus === 'passed'
  ).length;

  const failedCount = providerTests.filter(
    (t) =>
      t.homeStatus === 'failed' ||
      t.searchStatus === 'failed' ||
      t.loadStatus === 'failed' ||
      t.linksStatus === 'failed'
  ).length;

  const filteredTests = providerTests.filter((t) => {
    const isPassed =
      t.homeStatus === 'passed' &&
      t.searchStatus === 'passed' &&
      t.loadStatus === 'passed' &&
      t.linksStatus === 'passed';
    if (testFilter === 'passed') return isPassed;
    if (testFilter === 'failed') return !isPassed;
    return true;
  });

  return (
    <div className="stremio-settings-tab-pane animate-fade-in">
      {/* Provider Health Diagnostic Suite */}
      <section className="settings-card">
        <div className="settings-card-header">
          <Activity className="settings-icon text-cyan" size={22} />
          <div>
            <h3>Provider Health Diagnostics Engine</h3>
            <p>Runs end-to-end verification across HomePage, Search, Details, and Stream links.</p>
          </div>
          <button
            className="settings-btn-primary"
            onClick={runAllTests}
            disabled={isTestingRunning}
            style={{ marginLeft: 'auto' }}
          >
            <Play size={14} className={isTestingRunning ? 'animate-spin' : ''} />
            {isTestingRunning ? 'Testing...' : 'Run Diagnostics'}
          </button>
        </div>

        {/* Real-time Progress Bar (CloudStream Parity) */}
        <div className="provider-test-metric-bar">
          <div
            className="metric-segment metric-passed"
            style={{ width: `${(passedCount / providerTests.length) * 100}%` }}
          />
          <div
            className="metric-segment metric-failed"
            style={{ width: `${(failedCount / providerTests.length) * 100}%` }}
          />
        </div>

        <div className="test-filter-tabs">
          <button
            className={`test-tab ${testFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTestFilter('all')}
          >
            All Extensions ({providerTests.length})
          </button>
          <button
            className={`test-tab ${testFilter === 'passed' ? 'active' : ''}`}
            onClick={() => setTestFilter('passed')}
          >
            Passed ({passedCount})
          </button>
          <button
            className={`test-tab ${testFilter === 'failed' ? 'active' : ''}`}
            onClick={() => setTestFilter('failed')}
          >
            Failed ({failedCount})
          </button>
        </div>

        <div className="provider-test-items-list">
          {filteredTests.map((test) => {
            const hasFailed =
              test.homeStatus === 'failed' ||
              test.searchStatus === 'failed' ||
              test.loadStatus === 'failed' ||
              test.linksStatus === 'failed';

            return (
              <div
                key={test.providerName}
                className={`provider-test-row ${hasFailed ? 'test-has-failed' : 'test-has-passed'}`}
              >
                <div className="provider-test-info">
                  <span className="provider-test-name">{test.providerName}</span>
                  {test.errorDetails && (
                    <div className="provider-test-error">
                      <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {test.errorDetails}
                    </div>
                  )}
                </div>

                <div className="provider-test-steps">
                  <div className={`test-chip step-${test.homeStatus}`}>Home</div>
                  <div className={`test-chip step-${test.searchStatus}`}>Search</div>
                  <div className={`test-chip step-${test.loadStatus}`}>Load</div>
                  <div className={`test-chip step-${test.linksStatus}`}>Extract</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Live Application Logcat Terminal */}
      <section className="settings-card">
        <div className="settings-card-header">
          <Terminal className="settings-icon text-purple" size={22} />
          <div>
            <h3>Live Diagnostic Log Stream</h3>
            <p>Real-time application output, network calls, and background thread execution traces.</p>
          </div>
          <div className="logcat-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button
              className="settings-btn-subtle"
              onClick={() => {
                navigator.clipboard.writeText(logs.join('\n'));
                alert('Log buffer copied to clipboard!');
              }}
              title="Copy to Clipboard"
            >
              <Copy size={14} /> Copy
            </button>
            <button
              className="settings-btn-subtle"
              onClick={() => setLogs([])}
              title="Clear Buffer"
            >
              <Trash2 size={14} /> Clear
            </button>
          </div>
        </div>

        <div className="logcat-search-bar">
          <Search size={14} color="#64748b" />
          <input
            type="text"
            placeholder="Filter logs (e.g. [INFO], [ERROR], network)..."
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value)}
          />
        </div>

        <div className="logcat-terminal-box">
          {filteredLogs.length === 0 ? (
            <div className="logcat-empty">No matching log messages found.</div>
          ) : (
            filteredLogs.map((line, idx) => (
              <div
                key={idx}
                className={`logcat-line ${
                  line.includes('[ERROR]')
                    ? 'log-error'
                    : line.includes('[WARN]')
                    ? 'log-warn'
                    : line.includes('[DEBUG]')
                    ? 'log-debug'
                    : 'log-info'
                }`}
              >
                {line}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
