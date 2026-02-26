// ============================================================
// NEXCOM Exchange - Haptic Feedback Service
// ============================================================

import * as Haptics from "expo-haptics";

/**
 * Haptic feedback for order submission confirmation
 */
export async function hapticOrderSubmit(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Silently fail on devices without haptic support
  }
}

/**
 * Haptic feedback for order cancellation
 */
export async function hapticOrderCancel(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Silently fail
  }
}

/**
 * Haptic feedback for price alert trigger
 */
export async function hapticPriceAlert(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Silently fail
  }
}

/**
 * Light tap for button presses
 */
export async function hapticTap(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Silently fail
  }
}

/**
 * Medium impact for toggles and selections
 */
export async function hapticSelect(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Silently fail
  }
}

/**
 * Heavy impact for important actions
 */
export async function hapticHeavy(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // Silently fail
  }
}

/**
 * Selection change feedback (e.g., scrolling through picker)
 */
export async function hapticSelection(): Promise<void> {
  try {
    await Haptics.selectionAsync();
  } catch {
    // Silently fail
  }
}
