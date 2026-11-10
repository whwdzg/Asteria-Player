import { Add24Regular } from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import { useLibraryStore } from '../../state/library';
import { useUiStore } from '../../state/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { Modal } from '../common/Modal';

export function PlaylistDialog(): React.ReactElement {
  const open = useUiStore((state) => state.playlistDialogOpen);
  const trackIds = useUiStore((state) => state.playlistDialogTrackIds);
  const close = useUiStore((state) => state.closePlaylistDialog);
  const { t } = useI18n();
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  const create = (): void => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const library = useLibraryStore.getState();
    const playlist = library.addPlaylist(trimmed, trackIds);
    if (trackIds.length) library.setSequence(playlist.id);
    useUiStore.getState().pushToast(t('toast.playlistCreated'));
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('queue.new')}
      closeLabel={t('common.close')}
      size="sm"
      footer={
        <>
          <button type="button" className="fluent-button" onClick={close}>{t('common.cancel')}</button>
          <button type="button" className="fluent-button primary" onClick={create} disabled={!name.trim()}>
            <Add24Regular /> {t('queue.create')}
          </button>
        </>
      }
    >
      <form
        className="playlist-form"
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        <label htmlFor="playlist-name">{t('queue.namePlaceholder')}</label>
        <input
          id="playlist-name"
          value={name}
          maxLength={48}
          placeholder={t('queue.namePlaceholder')}
          onChange={(event) => setName(event.currentTarget.value)}
          autoComplete="off"
        />
        {trackIds.length ? <p className="form-hint">{t('common.count', { count: trackIds.length })}</p> : null}
      </form>
    </Modal>
  );
}
