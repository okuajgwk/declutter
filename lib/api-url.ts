import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function getApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // If running in web, relative paths work
  if (Platform.OS === 'web') {
    return '';
  }

  // Get the IP address of the development machine from Expo Constants
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    return `http://${debuggerHost}`;
  }
  
  // Fallback for simulators
  return 'http://localhost:8081';
}
