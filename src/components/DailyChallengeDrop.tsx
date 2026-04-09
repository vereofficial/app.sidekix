import { useCallback, useEffect, useState } from 'react';
import { AppState, Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/AppThemeContext';
import { useTodayChallenge } from '../hooks/useTodayChallenge';
import {
  isChallengeDropDismissed,
  markChallengeDropDismissed,
} from '../lib/challengeDropStorage';
import { getColors } from '../theme';
import { ChallengeDropOverlay } from './ChallengeDropOverlay';

export function DailyChallengeDrop() {
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { challenge, loading } = useTodayChallenge();
  const [visible, setVisible] = useState(false);
  const [overlayKey, setOverlayKey] = useState(0);

  const evaluate = useCallback(async () => {
    if (loading) return;
    if (!challenge) {
      setVisible(false);
      return;
    }
    try {
      const dismissed = await isChallengeDropDismissed();
      if (!dismissed) {
        setOverlayKey((k) => k + 1);
        setVisible(true);
      } else {
        setVisible(false);
      }
    } catch {
      setOverlayKey((k) => k + 1);
      setVisible(true);
    }
  }, [challenge, loading]);

  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void evaluate();
    });
    return () => sub.remove();
  }, [evaluate]);

  const onDismiss = async () => {
    await markChallengeDropDismissed();
    setVisible(false);
  };

  if (!visible || !challenge) return null;

  return (
    <Modal visible animationType="none" transparent statusBarTranslucent>
      <View style={styles.modalRoot}>
        <ChallengeDropOverlay
          key={overlayKey}
          colors={colors}
          scheme={resolvedScheme}
          insetsTop={insets.top}
          challenge={challenge}
          onGo={onDismiss}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: 'transparent' },
});
