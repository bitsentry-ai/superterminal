import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@bitsentry-ce/components/ui/button'
import { RefreshCw } from '@bitsentry-ce/components/icons'
import { useToast } from '@bitsentry-ce/components/hooks/use-toast'
import { useTranslation } from '@bitsentry-ce/i18n'
import { getDesktopApi, type DesktopUpdaterState } from '../services/desktop-api'

type UpdaterState = DesktopUpdaterState
type Translate = ReturnType<typeof useTranslation>['t']

interface UpdateSettingsSectionProps {
  mode?: 'card' | 'row'
}

function formatCheckedAt(checkedAt: string | null): string | null {
  if (checkedAt === null || checkedAt === '') return null

  const date = new Date(checkedAt)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString()
}

function formatDisabledReason(
  state: UpdaterState,
  t: Translate,
): string {
  if (typeof state.disabledReason === 'string' && state.disabledReason.length > 0) {
    return state.disabledReason
  }

  switch (state.disabledReasonCode) {
    case 'not-packaged':
      return t('settings.updateSettingsSection.automaticUpdatesRequirePackagedBuild')
    case 'smoke-test':
      return t('settings.updateSettingsSection.automaticUpdatesDisabledDuringSmokeTests')
    case 'unsupported-feed':
      return t('settings.updateSettingsSection.automaticUpdatesRequireSupportedFeed')
    default:
      return t('settings.updateSettingsSection.automaticUpdatesUnavailable')
  }
}

function formatDownloadingDescription(state: UpdaterState, t: Translate): string {
  const percent = state.downloadPercent
  if (percent === null) {
    return t('settings.updateSettingsSection.downloadingLatestUpdate')
  }

  return t('settings.updateSettingsSection.downloadingLatestUpdateWithPercent', {
    percent,
  })
}

function formatDefaultDescription(
  checkedAtLabel: string | null,
  t: Translate,
): string {
  if (checkedAtLabel !== null) {
    return t('settings.updateSettingsSection.lastCheckedDescription', {
      checkedAt: checkedAtLabel,
    })
  }

  return t('settings.updateSettingsSection.checkForNewDesktopReleases')
}

function formatSettledStatusDescription(
  state: UpdaterState,
  t: Translate,
): string | null {
  switch (state.status) {
    case 'downloaded':
      return t('settings.updateSettingsSection.versionReadyToInstall', {
        version: state.downloadedVersion ?? t('settings.updateSettingsSection.update'),
      })
    case 'installing':
      return t('settings.updateSettingsSection.restartingToInstall')
    case 'error':
      return state.message ?? t('settings.updateSettingsSection.lastUpdateCheckFailed')
    default:
      return null
  }
}

function formatActiveStatusDescription(
  state: UpdaterState,
  t: Translate,
): string | null {
  switch (state.status) {
    case 'disabled':
      return formatDisabledReason(state, t)
    case 'checking':
      return t('settings.updateSettingsSection.checkingForUpdatesNow')
    case 'available':
      return t('settings.updateSettingsSection.versionAvailableToDownload', {
        version: state.availableVersion ?? t('settings.updateSettingsSection.update'),
      })
    case 'downloading':
      return formatDownloadingDescription(state, t)
    default:
      return formatSettledStatusDescription(state, t)
  }
}

function formatStatusDescription(
  state: UpdaterState | null,
  checkedAtLabel: string | null,
  t: Translate,
): string {
  if (state === null) {
    return t('settings.updateSettingsSection.lastUpdateCheckFailed')
  }

  const statusDescription = formatActiveStatusDescription(state, t)
  if (statusDescription !== null) {
    return statusDescription
  }

  return formatDefaultDescription(checkedAtLabel, t)
}

function formatButtonLabel(status: UpdaterState['status'], t: Translate): string {
  switch (status) {
    case 'checking':
      return t('settings.updateSettingsSection.checking')
    case 'available':
      return t('settings.updateSettingsSection.downloadUpdate')
    case 'downloading':
      return t('settings.updateSettingsSection.downloading')
    case 'downloaded':
      return t('settings.updateSettingsSection.restartToInstall')
    case 'installing':
      return t('settings.updateSettingsSection.installing')
    default:
      return t('settings.updateSettingsSection.checkForUpdates')
  }
}

const disabledActionStatuses = new Set<UpdaterState['status']>([
  'disabled',
  'checking',
  'downloading',
  'installing',
])

function isActionDisabled(state: UpdaterState | null, busy: boolean): boolean {
  if (state === null) return true
  if (busy) return true

  return disabledActionStatuses.has(state.status)
}

function getDescriptionClass(status: UpdaterState['status'], size: string): string {
  let tone = 'text-muted-foreground'
  if (status === 'error') {
    tone = 'text-destructive'
  }

  return `mt-1 ${size} ${tone}`
}

function renderLastCheckedLabel(
  status: UpdaterState['status'],
  checkedAtLabel: string | null,
  className: string,
  t: Translate,
): ReactNode {
  if (status === 'disabled') return null
  if (checkedAtLabel === null) return null

  return (
    <p className={className}>
      {t('settings.updateSettingsSection.lastCheckedLabel', {
        checkedAt: checkedAtLabel,
      })}
    </p>
  )
}

export function UpdateSettingsSection({ mode = 'card' }: UpdateSettingsSectionProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [state, setState] = useState<UpdaterState | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const updater = getDesktopApi()?.updater
    if (updater === undefined) {
      setLoaded(true)
      return
    }

    void updater
      .getState()
      .then((initial) => {
        if (cancelled) return
        setState(initial)
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setLoaded(true)
        toast({
          title: t('settings.updateSettingsSection.error'),
          description: t('settings.updateSettingsSection.failedToLoadUpdaterStatus'),
          variant: 'destructive',
        })
      })

    const unsubscribe = updater.onState((next) => {
      if (cancelled) return
      setState(next)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [t, toast])

  const checkedAtLabel = useMemo(
    () => formatCheckedAt(state?.checkedAt ?? null),
    [state?.checkedAt],
  )

  const handleAction = useCallback(async () => {
    if (state === null) return

    const updater = getDesktopApi()?.updater
    if (updater === undefined) return

    setBusy(true)
    try {
      switch (state.status) {
        case 'available':
          await updater.download()
          break
        case 'downloaded':
          await updater.install()
          break
        default:
          if (typeof updater.check === 'function') {
            await updater.check()
          }
      }
    } catch {
      toast({
        title: t('settings.updateSettingsSection.error'),
        description: t('settings.updateSettingsSection.updateActionFailed'),
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }, [state, t, toast])

  const handleActionClick = useCallback(() => {
    void handleAction()
  }, [handleAction])

  if (!loaded) return null

  const status = state?.status ?? 'error'
  const description = formatStatusDescription(state, checkedAtLabel, t)
  const buttonLabel = formatButtonLabel(status, t)
  const disabled = isActionDisabled(state, busy)
  const rowDescriptionClass = getDescriptionClass(status, 'text-xs')
  const cardDescriptionClass = getDescriptionClass(status, 'text-[11px]')
  const rowLastCheckedLabel = renderLastCheckedLabel(
    status,
    checkedAtLabel,
    'mt-1 text-xs text-muted-foreground',
    t,
  )
  const cardLastCheckedLabel = renderLastCheckedLabel(
    status,
    checkedAtLabel,
    'mt-1 text-[11px] text-muted-foreground',
    t,
  )

  if (mode === 'row') {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-3" id="updates">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">
            {t('settings.updateSettingsSection.updates')}
          </p>
          <p className={rowDescriptionClass}>
            {description}
          </p>
          {rowLastCheckedLabel}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleActionClick}
          disabled={disabled}
          className="h-8 min-w-[140px] text-xs"
        >
          <RefreshCw className="mr-1.5" size={12} />
          {buttonLabel}
        </Button>
      </div>
    )
  }

  return (
    <section id="updates">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t('settings.updateSettingsSection.updates')}
        </h2>
      </div>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-foreground">
              {t('settings.updateSettingsSection.desktopAppUpdates')}
            </h3>
            <p className={cardDescriptionClass}>
              {description}
            </p>
            {cardLastCheckedLabel}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleActionClick}
            disabled={disabled}
            className="h-8 min-w-[140px] text-xs"
          >
            <RefreshCw className="mr-1.5" size={12} />
            {buttonLabel}
          </Button>
        </div>
      </div>
    </section>
  )
}
