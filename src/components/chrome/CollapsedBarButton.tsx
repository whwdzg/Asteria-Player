import { ChevronUp24Regular } from '@fluentui/react-icons';
import { useI18n } from '../../i18n/I18nProvider';
import { useLibraryStore } from '../../state/library';
import { useUiStore } from '../../state/ui';
import { CoverArt } from '../common/CoverArt';

/** Small artwork button shown at the bottom-left while the transport bar is collapsed. */
export function CollapsedBarButton(): React.ReactElement | null {
  const { t } = useI18n();
  const collapsed = useUiStore((state) => state.barCollapsed);
  const setBarCollapsed = useUiStore((state) => state.setBarCollapsed);
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === state.currentId));
  if (!collapsed) return null;

  return (
    <button
      type="button"
      className="bar-restore"
      aria-label={t('player.expandBar')}
      data-tooltip={t('player.expandBar')}
      onClick={() => setBarCollapsed(false)}
    >
      {track ? (
        <CoverArt track={track} className="bar-restore-cover" alt={t('a11y.cover', { title: track.title })} eager showKind />
      ) : (
        <img className="bar-restore-cover" src="icons/icon-192.png" alt="" aria-hidden="true" />
      )}
      <span className="bar-restore-chevron" aria-hidden="true"><ChevronUp24Regular /></span>
    </button>
  );
}
