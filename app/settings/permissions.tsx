import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useSmartBack } from '../../hooks/useSmartBack';
import { COLORS, FONTS } from '../../constants/colors';

type PermissionStatus = 'undetermined' | 'granted' | 'denied';

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

export default function PermissionsSettingsScreen() {
  const { goBack } = useSmartBack();
  const [permissions, setPermissions] = useState<Record<string, PermissionStatus>>({
    notifications: 'undetermined',
    camera: 'undetermined',
    microphone: 'undetermined',
    photoLibrary: 'undetermined',
  });

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

      if (result.status === 'denied' && result.canAskAgain === false) {
        return 'permanently_denied';
      }

      return result.status;
    } catch (error) {
      console.warn(`Permission request failed for ${key}:`, error);
      return 'undetermined';
    }
  }, []);

  const handleCardPress = async (key: string) => {
    if (permissions[key] === 'granted') return;

    if (permissions[key] === 'denied') {
      Linking.openSettings();
      return;
    }

    const result = await requestPermission(key);
    if (result === 'permanently_denied') {
      Linking.openSettings();
    }
  };

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Permissions</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.sectionDescription}>
          Manage app permissions for camera, microphone, and more. Tap a permission to change it.
        </Text>

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
                activeOpacity={status === 'granted' ? 1 : 0.7}
                onPress={() => handleCardPress(config.key)}
              >
                <View style={[
                  styles.iconContainer,
                  status === 'granted' && styles.iconContainerGranted,
                ]}>
                  <Ionicons
                    name={config.icon as any}
                    size={22}
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

        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.SECONDARY[400]} />
          <Text style={styles.infoText}>
            If a permission shows "Denied", tapping it will open your device settings where you can enable it.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: FONTS.BOLD,
    color: '#111827',
    flex: 1,
  },
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  sectionDescription: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginBottom: 20,
    lineHeight: 20,
  },
  cardsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  permissionCardGranted: {
    backgroundColor: COLORS.SUCCESS[50],
    borderWidth: 1,
    borderColor: COLORS.SUCCESS[200],
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#111827',
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
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    lineHeight: 18,
  },
});
