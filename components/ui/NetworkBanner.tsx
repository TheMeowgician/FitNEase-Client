import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';

const BANNER_HEIGHT = 32;

export function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;

  const updateStatus = (connected: boolean | null) => {
    setIsOffline(connected === false);
  };

  useEffect(() => {
    // Fetch current state immediately — addEventListener alone can miss the initial value
    NetInfo.fetch().then(state => updateStatus(state.isConnected));

    // Real-time subscription for changes while app is active
    const netUnsubscribe = NetInfo.addEventListener(state => {
      updateStatus(state.isConnected);
    });

    // Re-check when app comes back to foreground (handles airplane toggle from notification panel)
    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        NetInfo.fetch().then(state => updateStatus(state.isConnected));
      }
    });

    return () => {
      netUnsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: isOffline ? BANNER_HEIGHT : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isOffline]);

  return (
    <Animated.View style={[styles.banner, { height: heightAnim }]}>
      <Ionicons name="cloud-offline-outline" size={13} color="#FFFFFF" />
      <Text style={styles.text}>No internet · Features may not work</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    overflow: 'hidden',
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
