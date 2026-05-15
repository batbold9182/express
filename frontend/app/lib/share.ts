import { Platform, Share } from 'react-native';

export function shareUrl(url: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ url, title: message }).catch(() => {});
    } else {
      window.open(url, '_blank');
    }
  } else {
    Share.share({ url, message });
  }
}
