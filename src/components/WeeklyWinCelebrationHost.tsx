import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  loadPendingWeeklyEndMoment,
  markWeeklyPlacementCelebrationDismissed,
  markWeeklyWinCelebrationDismissed,
  type WeeklyEndMoment,
} from '../lib/weeklyWinCelebration';
import { WeeklyPlacementCelebrationModal } from './WeeklyPlacementCelebrationModal';
import { WeeklyWinCelebrationModal } from './WeeklyWinCelebrationModal';

export function WeeklyWinCelebrationHost() {
  const { user } = useAuth();
  const [moment, setMoment] = useState<WeeklyEndMoment | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || !user?.id) {
      setMoment(null);
      return;
    }
    let cancelled = false;
    void loadPendingWeeklyEndMoment(user.id).then((m) => {
      if (!cancelled) setMoment(m);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const onCloseWin = async () => {
    if (moment?.type === 'win') {
      await markWeeklyWinCelebrationDismissed(moment.payload.prevWeekKey);
    }
    setMoment(null);
  };

  const onClosePlacement = async () => {
    if (moment?.type === 'placement') {
      await markWeeklyPlacementCelebrationDismissed(moment.payload.prevWeekKey);
    }
    setMoment(null);
  };

  return (
    <>
      <WeeklyWinCelebrationModal
        visible={moment?.type === 'win'}
        payload={moment?.type === 'win' ? moment.payload : null}
        onClose={() => void onCloseWin()}
      />
      <WeeklyPlacementCelebrationModal
        visible={moment?.type === 'placement'}
        payload={moment?.type === 'placement' ? moment.payload : null}
        onClose={() => void onClosePlacement()}
      />
    </>
  );
}
