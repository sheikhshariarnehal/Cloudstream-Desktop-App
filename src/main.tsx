import ReactDOM from "react-dom/client";
import App from "./App";
import { SettingsProvider } from "./hooks/useSettings";
import { initTelemetry } from "./utils/openpulse";

// Initialize OpenPulse developer telemetry
initTelemetry();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <SettingsProvider>
    <App />
  </SettingsProvider>
);

