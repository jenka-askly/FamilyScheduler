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
                    Copy link
                  </button>
                  {copied ? <span className="fs-meta">Copied</span> : null}
                </div>
              ) : null}
              {groupId ? (
                <div className="fs-groupIdRow">
                  <span className="fs-meta">Group ID: {shortGroupId}</span>
                  <button type="button" className="icon-button" aria-label="Copy full group id" data-tooltip="Copy full ID" onClick={() => void copyGroupId()}>⧉</button>
                  {copiedId ? <span className="fs-meta">Copied</span> : null}
                </div>
              ) : null}
              <div className="fs-groupExplain">
                This link is required to return to this group—save it.
              </div>
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
        {groupId ? (
            <div>Only listed phone numbers can access this group.</div>
        ) : null}
      </div>
    </div>
  );
}
