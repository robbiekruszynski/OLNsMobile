import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  IBMPlexMono_400Regular,
  IBMPlexMono_700Bold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  Oxanium_400Regular,
  Oxanium_700Bold,
} from '@expo-google-fonts/oxanium';
import * as SplashScreen from 'expo-splash-screen';
import { MeshProvider } from './src/mesh/MeshContext';
import RootNavigator from './src/navigation/AppNavigator';
import { NavigationContainer } from '@react-navigation/native';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    IBMPlexMono_400Regular,
    IBMPlexMono_700Bold,
    Oxanium_400Regular,
    Oxanium_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <MeshProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </MeshProvider>
  );
}
