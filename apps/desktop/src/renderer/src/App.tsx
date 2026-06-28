import { DesktopRendererApp } from "@bitsentry-ce/components/desktop/DesktopRendererApp";
import AppSettings from "./pages/app-settings/AppSettings";
import "@bitsentry-ce/components/desktop/desktop-app.css";

export default function App() {
  return <DesktopRendererApp AppSettingsPage={AppSettings} />;
}
