import React, { useEffect, useMemo, useState } from "react";

const HeaderIcon = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const Link2 = () => <HeaderIcon><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 5" /><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 19" /></HeaderIcon>;
const Copy = () => <HeaderIcon><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></HeaderIcon>;

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
  const [copiedId, setCopiedId] = useState(false);
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

  useEffect(() => {
    if (!copiedId) return;
    const timer = window.setTimeout(() => setCopiedId(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  const copyGroupLink = async () => {
    if (!groupLink) return;
    try {
      await navigator.clipboard.writeText(groupLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const shortGroupId = groupId ? `${groupId.slice(0, 8)}…${groupId.slice(-4)}` : null;
  const copyGroupId = async () => {
    if (!groupId) return;
    try {
      await navigator.clipboard.writeText(groupId);
      setCopiedId(true);
    } catch {
      setCopiedId(false);
    }
  };

  return (
    <div className="fs-pageHeader">
      {groupName ? (
        <div className="fs-groupHeaderStack">
          <h1 className="fs-h1">{groupName}</h1>
          {groupId ? (
            <div className="fs-groupBlock">
              {groupLink ? (
                <div className="fs-groupLinkRow">
                  <button
                    type="button"
                    className="fs-btn fs-btn-ghost"
                    aria-label="Copy group link"
                    onClick={() => void copyGroupLink()}
                  >
                    <Link2 />
                    Invite
                  </button>
                  <span className="fs-meta">Copies full invite URL</span>
                  {copied ? <span className="fs-meta">Copied</span> : null}
                </div>
              ) : null}
              {groupId ? (
                <div className="fs-groupIdRow">
                  <span className="fs-meta">Group ID: {shortGroupId}</span>
                  <button type="button" className="icon-button" aria-label="Copy full group id" data-tooltip="Copy full ID" onClick={() => void copyGroupId()}><Copy /></button>
                  {copiedId ? <span className="fs-meta">Copied</span> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <h1 className="fs-h1">{title}</h1>
      )}

      {groupName ? (
        <p className="fs-groupName fs-pageTitle">
          {title}
        </p>
      ) : null}

      <div className="fs-meta fs-headerMeta">
        {description && (
          <p className="fs-desc">{description}</p>
        )}
        {groupId ? <div>Only listed phone numbers can access this group.</div> : null}
      </div>
    </div>
  );
}
