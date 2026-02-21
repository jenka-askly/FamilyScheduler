import React, { useEffect, useMemo, useState } from "react";

type Props = {
  title: string;
  description?: string;
  groupName?: string;
  groupId?: string;
};

export function PageHeader({
  title,
  description,
  groupName,
  groupId,
}: Props) {
  const [copied, setCopied] = useState(false);
  const groupLink = useMemo(() => {
    if (!groupId) return null;
    if (typeof window === 'undefined') return null;
    return `${window.location.origin}/#/g/${groupId}/app`;
  }, [groupId]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyGroupLink = async () => {
    if (!groupLink) return;
    try {
      await navigator.clipboard.writeText(groupLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={{ marginBottom: "24px" }}>
      {groupName ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8, marginBottom: 16 }}>
          <h1 className="fs-h1" style={{ margin: 0, lineHeight: 1.15 }}>{groupName}</h1>
          {groupId ? (
            <>
              {groupLink ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.1, flexWrap: 'wrap', margin: 0 }}>
                  <a href={groupLink} style={{ margin: 0 }}>{groupLink}</a>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Copy group link"
                    data-tooltip="Copy link"
                    onClick={() => void copyGroupLink()}
                  >
                    ⧉
                  </button>
                  {copied ? <span style={{ margin: 0 }}>Copied</span> : null}
                </div>
              ) : null}
              <div className="fs-meta" style={{ margin: 0, lineHeight: 1.2, fontSize: 12, color: 'var(--muted)' }}>
                This link is required to return to this group—save it.
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <h1 className="fs-h1">{title}</h1>
      )}

      {groupName ? (
        <p className="fs-groupName" style={{ margin: 0, fontWeight: 500 }}>
          {title}
        </p>
      ) : null}

      <div className="fs-meta" style={{ marginTop: 0, display: 'grid', gap: '0.25rem' }}>
        {description && (
          <p className="fs-desc" style={{ margin: 0 }}>{description}</p>
        )}
        {groupId ? (
            <div>Only listed phone numbers can access this group.</div>
        ) : null}
      </div>
    </div>
  );
}
