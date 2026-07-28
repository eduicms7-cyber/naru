import { Alert, AlertButton, Platform } from 'react-native';

/**
 * react-native-web's Alert.alert is a no-op, so signup/delete confirmations
 * silently did nothing on web. Falls back to window.alert/confirm there.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = [title, message].filter(Boolean).join('\n');
  const actionButtons = (buttons ?? []).filter((b) => b.style !== 'cancel');
  const cancelButton = buttons?.find((b) => b.style === 'cancel');

  if (actionButtons.length === 0) {
    window.alert(text);
    return;
  }

  for (const button of actionButtons) {
    if (window.confirm(button.text ? `${text}\n\n${button.text}` : text)) {
      button.onPress?.();
      return;
    }
  }
  cancelButton?.onPress?.();
}
