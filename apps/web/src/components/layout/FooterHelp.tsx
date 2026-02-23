import React from 'react';
import { Link, Typography } from '@mui/material';

export function FooterHelp() {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
      Need help? Contact <Link href="mailto:support@yapper-app.com">support@yapper-app.com</Link>.
    </Typography>
  );
}
