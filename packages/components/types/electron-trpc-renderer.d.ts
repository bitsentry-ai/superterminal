declare module "electron-trpc/renderer" {
  import type { TRPCLink } from "@trpc/client";
  import type { AnyRouter } from "@trpc/server";

  export function ipcLink<TRouter extends AnyRouter>(opts?: {
    transformer?: unknown;
  }): TRPCLink<TRouter>;
}
