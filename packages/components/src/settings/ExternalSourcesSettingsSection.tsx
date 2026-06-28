import ErrorSourcesManager from "../integrations/ErrorSourcesManager";

interface ExternalSourcesSettingsSectionProps {
  id?: string;
  className?: string;
  /** Unused; kept for back-compat with existing call sites. The manager uses i18n. */
  title?: string;
  description?: string;
  showManagerHeader?: boolean;
}

export function ExternalSourcesSettingsSection({
  id = "external-sources",
  className,
}: ExternalSourcesSettingsSectionProps) {
  return (
    <section id={id} data-tour="settings-external-sources" className={className}>
      <ErrorSourcesManager showHeader={true} />
    </section>
  );
}
