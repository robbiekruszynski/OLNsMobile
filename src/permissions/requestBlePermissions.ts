import { Platform } from 'react-native';
import {
  PERMISSIONS,
  request,
  requestMultiple,
  RESULTS,
} from 'react-native-permissions';

function isGranted(result: string): boolean {
  return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
}

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const results = await requestMultiple([
      PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
      PERMISSIONS.ANDROID.BLUETOOTH_ADVERTISE,
      PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
      PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    ]);

    return Object.values(results).every(isGranted);
  }

  if (Platform.OS === 'ios') {
    const result = await request(PERMISSIONS.IOS.BLUETOOTH);
    return isGranted(result);
  }

  return true;
}
