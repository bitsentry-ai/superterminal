import { initTRPC } from "@trpc/server";
import { z } from "zod";
import {
  DESKTOP_RPC_CHANNELS,
  desktopChannelToTrpcPath,
  type DesktopRpcChannel,
} from "./desktop-ipc-contract";

interface DesktopIpcDispatchLike {
  dispatch(channel: string, payload: unknown): Promise<unknown>;
}

const t = initTRPC.create({ isServer: true });

function createDesktopProcedure(
  dispatcher: DesktopIpcDispatchLike,
  channel: DesktopRpcChannel,
) {
  return t.procedure.input(z.unknown()).mutation(async ({ input }) => {
    return dispatcher.dispatch(channel, input);
  });
}

type DesktopProcedure = ReturnType<typeof createDesktopProcedure>;

export const createDesktopTrpcRouter = (dispatcher: DesktopIpcDispatchLike) => {
  const procedures: Record<string, DesktopProcedure> = {};

  for (const channel of DESKTOP_RPC_CHANNELS) {
    const path = desktopChannelToTrpcPath(channel);
    procedures[path] = createDesktopProcedure(dispatcher, channel);
  }

  return t.router(procedures);
};

export type DesktopTrpcRouter = ReturnType<typeof createDesktopTrpcRouter>;
