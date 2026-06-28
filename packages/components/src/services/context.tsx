import React, { createContext, useContext } from "react";

import type { BitsentryServicePorts } from "./contracts";

interface BitsentryServicesProviderProps {
  services: BitsentryServicePorts;
  children: React.ReactNode;
}

const BitsentryServicesContext = createContext<BitsentryServicePorts | null>(
  null,
);

export function BitsentryServicesProvider({
  services,
  children,
}: BitsentryServicesProviderProps) {
  return (
    <BitsentryServicesContext.Provider value={services}>
      {children}
    </BitsentryServicesContext.Provider>
  );
}

export function useBitsentryServices(): BitsentryServicePorts {
  const context = useContext(BitsentryServicesContext);

  if (!context) {
    throw new Error(
      "BitsentryServicesProvider is missing. Wrap the app with a service provider implementation.",
    );
  }

  return context;
}
