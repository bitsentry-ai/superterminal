import React from "react";
import Navbar, { type SettingsSectionLink } from "./Navbar";
import TopBar from "./TopBar";
import { cn } from "../lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  mainClassName?: string;
  adminSettingsExtraSections?: readonly SettingsSectionLink[];
  appSettingsExtraSections?: readonly SettingsSectionLink[];
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  mainClassName,
  adminSettingsExtraSections,
  appSettingsExtraSections,
}) => {
  return (
    <div className="flex h-screen overflow-hidden">
      <Navbar
        adminSettingsExtraSections={adminSettingsExtraSections}
        appSettingsExtraSections={appSettingsExtraSections}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className={cn("flex-1 overflow-auto px-8 pt-3 pb-8", mainClassName)}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
