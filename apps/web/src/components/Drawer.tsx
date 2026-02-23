import { ReactNode, useEffect } from 'react';

type DrawerProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
};

export function Drawer({ open, title, onClose, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fs-drawer-overlay" onClick={onClose} role="presentation">
      <aside
        className="fs-drawer-panel"
        aria-modal="true"
        role="dialog"
        aria-label={title ?? 'Drawer'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="fs-drawer-header">
          {title ? <h2 className="fs-drawer-title">{title}</h2> : <div className="fs-drawer-titleSpacer" />}
          <button type="button" className="fs-drawer-closeButton" onClick={onClose} aria-label="Close drawer">
            ×
          </button>
        </div>
        <div className="fs-drawer-content">{children}</div>
      </aside>
    </div>
  );
}
