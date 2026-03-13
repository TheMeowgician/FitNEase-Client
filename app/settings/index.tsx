import React from 'react';
import {
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAlert } from '../../contexts/AlertContext';
import { useSmartBack } from '../../hooks/useSmartBack';
import { COLORS, FONTS } from '../../constants/colors';

export default function SettingsScreen() {
  const alert = useAlert();
  const { goBack } = useSmartBack();

  const menuItems = [
    {
      section: 'Tabata Training',
      items: [
        {
          icon: 'flash-outline',
          title: 'Exercise Library',
          subtitle: 'Browse Tabata exercises',
          onPress: () => {
            router.push('/exercises/library');
          },
        },
        {
          icon: 'timer-outline',
          title: 'Custom Workouts',
          subtitle: 'Create your own routines',
          onPress: () => {
            alert.info('Coming Soon', 'Custom workouts will be available soon!');
          },
        },
        {
          icon: 'people-outline',
          title: 'Find Instructors',
          subtitle: 'Connect with trainers',
          onPress: () => {
            alert.info('Coming Soon', 'Instructor finder will be available soon!');
          },
        },
      ],
    },
    {
      section: 'App Settings',
      items: [
        {
          icon: 'notifications-outline',
          title: 'Notifications',
          subtitle: 'Manage your reminders',
          onPress: () => {
            router.push('/settings/notifications');
          },
        },
        {
          icon: 'shield-checkmark-outline',
          title: 'Permissions',
          subtitle: 'Camera, microphone & photo access',
          onPress: () => {
            router.push('/settings/permissions');
          },
        },
        {
          icon: 'language-outline',
          title: 'Language',
          subtitle: 'Change app language',
          onPress: () => {
            alert.info('Coming Soon', 'Language settings will be available soon!');
          },
        },
        {
          icon: 'moon-outline',
          title: 'Dark Mode',
          subtitle: 'Toggle theme',
          onPress: () => {
            alert.info('Coming Soon', 'Dark mode will be available soon!');
          },
        },
      ],
    },
    {
      section: 'Support',
      items: [
        {
          icon: 'document-text-outline',
          title: 'Privacy Policy & Terms',
          subtitle: 'View legal documents',
          onPress: () => {
            router.push('/settings/legal');
          },
        },
        {
          icon: 'help-circle-outline',
          title: 'Help & FAQ',
          subtitle: 'Get assistance',
          onPress: () => {
            alert.info('Coming Soon', 'Help section will be available soon!');
          },
        },
        {
          icon: 'mail-outline',
          title: 'Contact Support',
          subtitle: 'Reach out to us',
          onPress: () => {
            alert.info('Coming Soon', 'Support contact will be available soon!');
          },
        },
        {
          icon: 'star-outline',
          title: 'Rate App',
          subtitle: 'Share your feedback',
          onPress: () => {
            alert.info('Coming Soon', 'App rating will be available soon!');
          },
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Menu Sections */}
        <View style={styles.menuContainer}>
          {menuItems.map((section, sectionIndex) => (
            <View key={sectionIndex} style={styles.menuSection}>
              <Text style={styles.menuSectionTitle}>
                {section.section}
              </Text>
              <View style={styles.menuCard}>
                {section.items.map((item, itemIndex) => (
                  <TouchableOpacity
                    key={itemIndex}
                    style={[
                      styles.menuItem,
                      itemIndex !== section.items.length - 1 && styles.menuItemBorder,
                    ]}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuIcon}>
                      <Ionicons name={item.icon as any} size={20} color="#6B7280" />
                    </View>
                    <View style={styles.menuContent}>
                      <Text style={styles.menuTitle}>{item.title}</Text>
                      <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
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
  },
  menuContainer: {
    paddingHorizontal: 24,
  },
  menuSection: {
    marginBottom: 24,
  },
  menuSectionTitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  menuCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#111827',
  },
  menuSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    marginTop: 2,
  },
});
