import React from "react";

type PageProps = {
  children: React.ReactNode;
  variant?: "form" | "workspace";
};

export function Page({ children, variant = "workspace" }: PageProps) {
  if (variant === "form") {
    return (
      <div className="fs-page">
        <div className="fs-formWrap">
          <div className="fs-card">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fs-page">
      {children}
    </div>
  );
}
