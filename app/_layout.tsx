import { Slot, SplashScreen } from 'expo-router';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Context Providers
import { AuthProvider } from '../contexts/AuthContext';
import { UserProvider } from '../contexts/UserContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { NetworkProvider } from '../contexts/NetworkContext';
import { WebSocketProvider } from '../contexts/WebSocketContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { LobbyProvider } from '../contexts/LobbyContext';
import { ReverbProvider } from '../contexts/ReverbProvider';
import { AlertProvider } from '../contexts/AlertContext';

// Global Lobby Components
import { GlobalLobbyIndicator } from '../components/lobby/GlobalLobbyIndicator';
import { ReadyCheckHandler } from '../components/lobby/ReadyCheckHandler';
import { ReadyCheckModal } from '../components/lobby/ReadyCheckModal';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // Use only available Poppins fonts
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
    "Poppins-Regular": require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <NetworkProvider>
            <AuthProvider>
              <UserProvider>
                <AlertProvider>
                  <ReverbProvider>
                    <LobbyProvider>
                      <NotificationProvider>
                        <WebSocketProvider>
                          <StatusBar style="auto" />
                          <View style={{ flex: 1 }}>
                            <Slot />
                            {/* Global Lobby Components - render on top of all screens */}
                            <GlobalLobbyIndicator />
                            <ReadyCheckHandler />
                            <ReadyCheckModal />
                          </View>
                        </WebSocketProvider>
                      </NotificationProvider>
                    </LobbyProvider>
                  </ReverbProvider>
                </AlertProvider>
              </UserProvider>
            </AuthProvider>
          </NetworkProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
