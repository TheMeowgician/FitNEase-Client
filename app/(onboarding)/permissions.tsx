import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';

import { Button } from '../../components/ui/Button';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';

const { width } = Dimensions.get('window');

type PermissionStatus = 'undetermined' | 'granted' | 'denied';

interface PermissionItem {
  key: string;
  icon: string;
  title: string;
  description: string;
  status: PermissionStatus;
}

const PERMISSION_CONFIG = [
  {
    key: 'notifications',
    icon: 'notifications-outline',
    title: 'Notifications',
    description: 'Workout reminders and group updates',
  },
  {
    key: 'camera',
    icon: 'camera-outline',
    title: 'Camera',
    description: 'Video calls during group workouts',
  },
  {
    key: 'microphone',
    icon: 'mic-outline',
    title: 'Microphone',
    description: 'Voice chat during group workouts',
  },
  {
    key: 'photoLibrary',
    icon: 'images-outline',
    title: 'Photo Library',
    description: 'Upload profile and group pictures',
  },
];

export default function PermissionsScreen() {
  const [permissions, setPermissions] = useState<Record<string, PermissionStatus>>({
    notifications: 'undetermined',
    camera: 'undetermined',
    microphone: 'undetermined',
    photoLibrary: 'undetermined',
  });
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    const [notifStatus, cameraStatus, audioStatus, mediaStatus] = await Promise.all([
      Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined' })),
      Camera.getCameraPermissionsAsync().catch(() => ({ status: 'undetermined' })),
      Audio.getPermissionsAsync().catch(() => ({ status: 'undetermined' })),
      ImagePicker.getMediaLibraryPermissionsAsync().catch(() => ({ status: 'undetermined' })),
    ]);

    setPermissions({
      notifications: mapStatus(notifStatus.status),
      camera: mapStatus(cameraStatus.status),
      microphone: mapStatus(audioStatus.status),
      photoLibrary: mapStatus(mediaStatus.status),
    });
  };

  const mapStatus = (status: string): PermissionStatus => {
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  };

  const requestPermission = useCallback(async (key: string) => {
    try {
      let result: { status: string; canAskAgain?: boolean } = { status: 'undetermined' };

      switch (key) {
        case 'notifications':
          result = await Notifications.requestPermissionsAsync();
          break;
        case 'camera':
          result = await Camera.requestCameraPermissionsAsync();
          break;
        case 'microphone':
          result = await Audio.requestPermissionsAsync();
          break;
        case 'photoLibrary':
          result = await ImagePicker.requestMediaLibraryPermissionsAsync();
          break;
      }

      setPermissions((prev) => ({
        ...prev,
        [key]: mapStatus(result.status),
      }));

      // If denied and can't ask again (iOS), offer to open settings
      if (result.status === 'denied' && result.canAskAgain === false) {
        return 'permanently_denied';
      }

      return result.status;
    } catch (error) {
      console.warn(`Permission request failed for ${key}:`, error);
      return 'undetermined';
    }
  }, []);

  const handleAllowAll = async () => {
    if (isRequesting) return; // Prevent re-entry on rapid taps
    setIsRequesting(true);
    try {
      // Request permissions sequentially to avoid dialog overlap
      for (const config of PERMISSION_CONFIG) {
        if (permissions[config.key] !== 'granted') {
          await requestPermission(config.key);
        }
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleCardPress = async (key: string) => {
    // If already granted, open device settings so the user can revoke if needed
    if (permissions[key] === 'granted') {
      Linking.openSettings();
      return;
    }

    // If already denied (can't re-ask on iOS), open settings
    if (permissions[key] === 'denied' && Platform.OS === 'ios') {
      Linking.openSettings();
      return;
    }

    const result = await requestPermission(key);
    if (result === 'permanently_denied') {
      Linking.openSettings();
    }
  };

  const navigatingRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleContinue = () => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    // Smooth fade-out before navigating to dashboard
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      router.replace('/(tabs)');
    });
  };

  const allGranted = Object.values(permissions).every((s) => s === 'granted');
  const someGranted = Object.values(permissions).some((s) => s === 'granted');

  const getStatusColor = (status: PermissionStatus) => {
    switch (status) {
      case 'granted': return COLORS.SUCCESS[500];
      case 'denied': return COLORS.ERROR[500];
      default: return COLORS.SECONDARY[400];
    }
  };

  const getStatusIcon = (status: PermissionStatus): string => {
    switch (status) {
      case 'granted': return 'checkmark-circle';
      case 'denied': return 'close-circle';
      default: return 'ellipse-outline';
    }
  };

  const getStatusLabel = (status: PermissionStatus) => {
    switch (status) {
      case 'granted': return 'Allowed';
      case 'denied': return 'Denied';
      default: return 'Not Set';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/FitNEase_logo_without_text.png')}
            style={[styles.logo, { width: width * 0.2, height: width * 0.2 }]}
            resizeMode="contain"
          />
        </View>

        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>
            <Text style={styles.titleAccent}>App</Text> Permissions
          </Text>
          <Text style={styles.subtitle}>
            To give you the best experience, FitNEase needs access to a few features on your device.
          </Text>
        </View>

        {/* Permission Cards */}
        <View style={styles.cardsContainer}>
          {PERMISSION_CONFIG.map((config) => {
            const status = permissions[config.key];
            return (
              <TouchableOpacity
                key={config.key}
                style={[
                  styles.permissionCard,
                  status === 'granted' && styles.permissionCardGranted,
                ]}
                activeOpacity={0.7}
                onPress={() => handleCardPress(config.key)}
              >
                <View style={[
                  styles.iconContainer,
                  status === 'granted' && styles.iconContainerGranted,
                ]}>
                  <Ionicons
                    name={config.icon as any}
                    size={24}
                    color={status === 'granted' ? COLORS.SUCCESS[600] : COLORS.PRIMARY[500]}
                  />
                </View>

                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{config.title}</Text>
                  <Text style={styles.cardDescription}>{config.description}</Text>
                </View>

                <View style={styles.statusContainer}>
                  <Ionicons
                    name={getStatusIcon(status) as any}
                    size={22}
                    color={getStatusColor(status)}
                  />
                  <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
                    {getStatusLabel(status)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info text */}
        <View style={styles.infoContainer}>
          <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.SECONDARY[400]} />
          <Text style={styles.infoText}>
            You can change these anytime in your device settings. We only use permissions when needed.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom buttons */}
      <View style={styles.buttonContainer}>
        {!allGranted && (
          <Button
            title={isRequesting ? 'Requesting...' : 'Allow All'}
            onPress={handleAllowAll}
            disabled={isRequesting}
            style={styles.allowButton}
          />
        )}

        <TouchableOpacity
          onPress={handleContinue}
          style={styles.skipButton}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.skipText,
            allGranted && styles.skipTextPrimary,
          ]}>
            {allGranted ? 'Continue to App' : 'Maybe Later'}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={18}
            color={allGranted ? COLORS.PRIMARY[500] : COLORS.SECONDARY[500]}
          />
        </TouchableOpacity>
      </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {},
  headerContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 12,
  },
  titleAccent: {
    color: COLORS.PRIMARY[500],
  },
  subtitle: {
    fontSize: 15,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 22,
  },
  cardsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.NEUTRAL[50],
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.NEUTRAL[200],
  },
  permissionCardGranted: {
    backgroundColor: COLORS.SUCCESS[50],
    borderColor: COLORS.SUCCESS[200],
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.PRIMARY[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconContainerGranted: {
    backgroundColor: COLORS.SUCCESS[100],
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  cardDescription: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 2,
  },
  statusContainer: {
    alignItems: 'center',
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontFamily: FONTS.MEDIUM,
    marginTop: 2,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    lineHeight: 18,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    gap: 12,
  },
  allowButton: {
    shadowColor: COLORS.PRIMARY[500],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  skipText: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[500],
  },
  skipTextPrimary: {
    color: COLORS.PRIMARY[500],
  },
});
