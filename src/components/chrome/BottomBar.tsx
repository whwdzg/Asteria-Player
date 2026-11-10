import { useI18n } from '../../i18n/I18nProvider';
import { ProgressBar } from './ProgressBar';
import { TrackIdentity } from './TrackIdentity';
import { TransportControls } from './TransportControls';
import { UtilityBar } from './UtilityBar';

interface BottomBarProps {
  onToggleFullscreen: () => void;
}

export function BottomBar({ onToggleFullscreen }: BottomBarProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <footer className="bottom-bar" aria-label={t('app.name')}>
      <ProgressBar />
      <div className="bottom-bar-content">
        <div className="bottom-left"><TrackIdentity /></div>
        <div className="bottom-center"><TransportControls /></div>
        <div className="bottom-right"><UtilityBar onToggleFullscreen={onToggleFullscreen} /></div>
      </div>
    </footer>
  );
}
