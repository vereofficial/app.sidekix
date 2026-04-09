/**
 * Compatibility shim — some worktrees still import this name.
 * Prefer `SidekixTabState` for new code.
 */
import type { ThemeColors } from '../theme';
import { SidekixTabState } from './SidekixTabState';

type Props = {
  variant: 'today' | 'feed';
  colors: ThemeColors;
  scheme: 'light' | 'dark';
  minHeight: number;
  onRetry?: () => void;
};

export function NoSidequestEmpty({ variant, colors, scheme, minHeight, onRetry }: Props) {
  return (
    <SidekixTabState
      variant={variant}
      reason="no-challenge"
      colors={colors}
      scheme={scheme}
      minHeight={minHeight}
      onRetry={onRetry}
    />
  );
}
