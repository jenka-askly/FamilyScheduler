import React from 'react';
import { Link, Paper, Typography } from '@mui/material';
import { buildInfo } from '../../lib/buildInfo';

type FooterHelpProps = {
  usageLabel?: string;
};

const resolveBuildLabel = (): string => {
  const sha = typeof buildInfo.sha === 'string' ? buildInfo.sha.trim() : '';
  const shortSha = sha ? sha.slice(0, 7) : '';
  const time = typeof buildInfo.time === 'string' ? buildInfo.time.trim() : '';
  const buildText = [shortSha, time].filter(Boolean).join(' ');
  return buildText || 'unknown';
};

export function FooterHelp({ usageLabel }: FooterHelpProps) {
  const buildLabel = resolveBuildLabel();
  const statusLabel = usageLabel ? `Build: ${buildLabel} · ${usageLabel}` : `Build: ${buildLabel}`;

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Need help? Contact <Link href="mailto:support@yapper-app.com">support@yapper-app.com</Link>.
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          position: 'fixed',
          right: '12px',
          bottom: '12px',
          zIndex: (theme) => theme.zIndex.snackbar,
          px: 1,
          py: 0.5,
          opacity: 0.85,
          backdropFilter: 'blur(2px)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
          {statusLabel}
        </Typography>
      </Paper>
    </>
  );
}
