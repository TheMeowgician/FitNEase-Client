import * as Haptics from 'expo-haptics';

/**
 * Safe haptic feedback wrappers.
 * All calls are wrapped in try/catch — will silently no-op
 * on unsupported devices or emulators.
 */

/** Light tap — for button presses, tab switches */
export const hapticLight = () => {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
};

/** Medium tap — for successful actions */
export const hapticMedium = () => {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
};

/** Success notification — for completed actions, achievements */
export const hapticSuccess = () => {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
};

/** Warning notification — for warnings */
export const hapticWarning = () => {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {}
};

/** Error notification — for errors, destructive actions */
export const hapticError = () => {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {}
};
