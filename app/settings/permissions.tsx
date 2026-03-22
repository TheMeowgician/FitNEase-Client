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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    const [notifStatus, cameraStatus, audioStatus, mediaStatus] = await Promise.all([
      Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined', canAskAgain: true })),
      Camera.getCameraPermissionsAsync().catch(() => ({ status: 'undetermined', canAskAgain: true })),
      Audio.getPermissionsAsync().catch(() => ({ status: 'undetermined', canAskAgain: true })),
      ImagePicker.getMediaLibraryPermissionsAsync().catch(() => ({ status: 'undetermined', canAskAgain: true })),
    ]);

    setPermissions({
      notifications: mapStatus(notifStatus.status, (notifStatus as any).canAskAgain),
      camera: mapStatus(cameraStatus.status, (cameraStatus as any).canAskAgain),
      microphone: mapStatus(audioStatus.status, (audioStatus as any).canAskAgain),
      photoLibrary: mapStatus(mediaStatus.status, (mediaStatus as any).canAskAgain),
    });
  };

  const mapStatus = (status: string, canAskAgain?: boolean): PermissionStatus => {
    if (status === 'granted') return 'granted';
    // Only show 'denied' if user explicitly denied AND can't ask again
    // On Android 13+, status can be 'denied' even when never asked (canAskAgain is true)
    if (status === 'denied' && canAskAgain === false) return 'denied';
    if (status === 'denied' && canAskAgain !== false) return 'undetermined';
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

  const handleCardPress = (key: string) => {
    // Already granted — no action needed in settings
    if (permissions[key] === 'granted') return;

    // Denied — open device settings to change
    if (permissions[key] === 'denied') {
      Linking.openSettings();
      return;
    }

    // Toggle selection for undetermined cards
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleAllowSelected = async () => {
    if (isRequesting || selected.size === 0) return;
    setIsRequesting(true);
    try {
      for (const key of selected) {
        if (permissions[key] !== 'granted') {
          await requestPermission(key);
        }
      }
      setSelected(new Set());
    } finally {
      setIsRequesting(false);
    }
  };

  const getStatusColor = (status: PermissionStatus, isSelected: boolean) => {
    if (isSelected && status !== 'granted') return COLORS.PRIMARY[500];
    switch (status) {
      case 'granted': return COLORS.SUCCESS[500];
      case 'denied': return COLORS.ERROR[500];
      default: return COLORS.SECONDARY[400];
    }
  };

  const getStatusIcon = (status: PermissionStatus, isSelected: boolean): string => {
    if (isSelected && status !== 'granted') return 'checkmark-circle';
    switch (status) {
      case 'granted': return 'checkmark-circle';
      case 'denied': return 'close-circle';
      default: return 'ellipse-outline';
    }
  };

  const getStatusLabel = (status: PermissionStatus, isSelected: boolean) => {
    if (isSelected && status !== 'granted') return 'Selected';
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
            const isSelected = selected.has(config.key);
            return (
              <TouchableOpacity
                key={config.key}
                style={[
                  styles.permissionCard,
                  status === 'granted' && styles.permissionCardGranted,
                  isSelected && status !== 'granted' && styles.permissionCardSelected,
                ]}
                activeOpacity={status === 'granted' ? 1 : 0.7}
                onPress={() => handleCardPress(config.key)}
              >
                <View style={[
                  styles.iconContainer,
                  status === 'granted' && styles.iconContainerGranted,
                  isSelected && status !== 'granted' && styles.iconContainerSelected,
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
                    name={getStatusIcon(status, isSelected) as any}
                    size={22}
                    color={getStatusColor(status, isSelected)}
                  />
                  <Text style={[styles.statusText, { color: getStatusColor(status, isSelected) }]}>
                    {getStatusLabel(status, isSelected)}
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

      {selected.size > 0 && (
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={[styles.allowButton, isRequesting && styles.allowButtonDisabled]}
            activeOpacity={0.7}
            onPress={handleAllowSelected}
            disabled={isRequesting}
          >
            <Text style={styles.allowButtonText}>
              {isRequesting ? 'Requesting...' : 'Allow Selected'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  permissionCardSelected: {
    backgroundColor: COLORS.PRIMARY[50],
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[300],
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
  iconContainerSelected: {
    backgroundColor: COLORS.PRIMARY[100],
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
  bottomButtonContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  allowButton: {
    backgroundColor: COLORS.PRIMARY[500],
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  allowButtonDisabled: {
    opacity: 0.6,
  },
  allowButtonText: {
    color: 'white',
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
  },
});
