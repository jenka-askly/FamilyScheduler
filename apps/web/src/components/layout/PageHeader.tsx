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
      {groupName ? <h1 className="fs-h1">{groupName}</h1> : <h1 className="fs-h1">{title}</h1>}

      {groupId ? (
        <div className="fs-meta" style={{ marginTop: '0.2rem', display: 'grid', gap: '0.3rem' }}>
          {groupLink ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <a href={groupLink}>{groupLink}</a>
              <button
                type="button"
                className="icon-button"
                aria-label="Copy group link"
                data-tooltip="Copy link"
                onClick={() => void copyGroupLink()}
              >
                ⧉
              </button>
              {copied ? <span>Copied</span> : null}
            </div>
          ) : null}
          <div>This link is required to return to this group—save it.</div>
        </div>
      ) : null}

      {groupName ? (
        <p className="fs-groupName" style={{ marginTop: '0.6rem', fontWeight: 500 }}>
          {title}
        </p>
      ) : null}

      <div className="fs-meta" style={{ marginTop: '0.35rem', display: 'grid', gap: '0.25rem' }}>
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
