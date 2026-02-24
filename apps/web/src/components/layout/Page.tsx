import React from 'react';
import { Box, Container, Paper } from '@mui/material';

type PageProps = {
  children: React.ReactNode;
  variant?: 'form' | 'workspace';
};

export function Page({ children, variant = 'workspace' }: PageProps) {
  if (variant === 'form') {
    return (
      <Box sx={{ minHeight: '100vh', py: 6 }}>
        <Container maxWidth="md">
          <Paper>{children}</Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', py: 3 }}>
      <Container maxWidth="lg">{children}</Container>
    </Box>
  );
}
