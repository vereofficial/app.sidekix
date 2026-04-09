/**
 * Haptics via `expo-haptics`. Import `hapticLight` / `hapticMedium` / `hapticSuccess` from here
 * and call on press (light), important actions (medium), or completed flows (success).
 * No extra native setup beyond having the Expo dev client / Expo Go on a device that supports vibration.
 */
import * as Haptics from 'expo-haptics';

export function hapticLight() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function hapticSuccess() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function hapticMedium() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function hapticHeavy() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Stronger “moment” for the challenge drop reveal (stacked impacts). */
export function hapticChallengeDropBurst() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  setTimeout(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, 110);
  setTimeout(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, 220);
}
