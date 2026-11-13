import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps): React.ReactElement {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      closeLabel={cancelLabel}
      size="sm"
      footer={
        <>
          <button type="button" className="fluent-button" onClick={onClose}>{cancelLabel}</button>
          <button
            type="button"
            className={`fluent-button ${danger ? 'danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-message">{message}</p>
    </Modal>
  );
}
