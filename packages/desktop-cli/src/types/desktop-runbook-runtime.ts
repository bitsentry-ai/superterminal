declare module '@bitsentry-desktop/runbook-runtime' {
  export const DesktopRunbookRuntime: {
    create: (
      options?: import('../cli/runbooks-cli').RunbookCliRuntimeOptions,
    ) => Promise<import('../cli/runbooks-cli').RunbookCliRuntime>
  }
}
