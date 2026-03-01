import { ReactNode } from 'react';
import { Box, Divider, Stack } from '@mui/material';

type TabPanelToolbarProps = {
  left?: ReactNode;
  right?: ReactNode;
  px?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
  bodyPt?: number;
  children: ReactNode;
};

export function TabPanelToolbar({ left, right, px, bodyPt = 2, children }: TabPanelToolbarProps) {
  return (
    <Box sx={px !== undefined ? { px } : undefined}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ gap: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>{left}</Box>
        {right ? <Stack direction="row" spacing={1} alignItems="center">{right}</Stack> : <Box />}
      </Stack>
      <Divider />
      <Box sx={{ pt: bodyPt }}>{children}</Box>
    </Box>
  );
}
