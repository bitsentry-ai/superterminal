import {
  createDesktopBitsentryApi,
  exposeDesktopPreload,
  type CreateDesktopBitsentryApiOptions,
  type DesktopBitsentryApi,
} from './desktop-preload-bridge'

export function configureDesktopPreloadRuntime(
  options: CreateDesktopBitsentryApiOptions,
): DesktopBitsentryApi {
  const bitsentryApi = createDesktopBitsentryApi(options)
  exposeDesktopPreload(options.bridge, bitsentryApi)
  return bitsentryApi
}
