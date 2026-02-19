import React from "react";

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
  return (
    <div style={{ marginBottom: "24px" }}>
      <h1 className="fs-h1">{title}</h1>

      {description && (
        <p className="fs-desc">{description}</p>
      )}

      {groupName && (
        <div>
          <div className="fs-groupName">{groupName}</div>
          {groupId && (
            <div className="fs-meta">
              Group ID: {groupId}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
