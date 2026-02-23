import React, { useEffect, useMemo, useState } from "react";

const HeaderIcon = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const Link2 = () => <HeaderIcon><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 5" /><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 19" /></HeaderIcon>;

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
    <div className="fs-pageHeader">
      {groupName ? (
        <div className="fs-groupHeaderStack">
          <h1 className="fs-h1">{groupName}</h1>
          {groupId ? (
            <div className="fs-inviteCard">
              {groupLink ? (
                <>
                  <div className="fs-inviteCardTop">
                    <div className="fs-inviteCardLabel">Invite link</div>
                    <button
                      type="button"
                      className="fs-btn fs-btn-secondary"
                      aria-label="Copy invite link"
                      onClick={() => void copyGroupLink()}
                    >
                      <Link2 />
                      Copy link
                    </button>
                  </div>
                  <div className="fs-inviteCardUrlRow">
                    <code className="fs-inviteCardUrl">{groupLink}</code>
                  </div>
                  <div className="fs-inviteCardHelp">
                    Save this link — it’s the only way to return to this group.
                  </div>
                  {copied ? <span className="fs-meta">Copied</span> : null}
                </>
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
