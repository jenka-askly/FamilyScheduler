import { MutableRefObject, ReactNode, useEffect } from 'react';

type DrawerProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  contentRef?: MutableRefObject<HTMLDivElement | null>;
};

export function Drawer({ open, title, onClose, children, contentRef }: DrawerProps) {
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
    <div className="ui-drawer-overlay" onClick={onClose} role="presentation">
      <aside
        className="ui-drawer-panel"
        aria-modal="true"
        role="dialog"
        aria-label={title ?? 'Drawer'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ui-drawer-header">
          {title ? <h2 className="ui-drawer-title">{title}</h2> : <div className="ui-drawer-titleSpacer" />}
          <button type="button" className="ui-drawer-closeButton" onClick={onClose} aria-label="Close drawer">
            ×
          </button>
        </div>
        <div className="ui-drawer-content" ref={contentRef}>{children}</div>
      </aside>
    </div>
  );
}
