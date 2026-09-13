import ReactDOM from "react-dom/client";
import App from "./App";
import { SettingsProvider } from "./hooks/useSettings";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <SettingsProvider>
    <App />
  </SettingsProvider>
);

