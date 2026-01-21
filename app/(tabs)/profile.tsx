import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { authService } from '../../services/microservices/authService';
import { COLORS, FONTS } from '../../constants/colors';
import { capitalizeFirstLetter } from '../../utils/stringUtils';
import FitnessLevelBadge from '../../components/FitnessLevelBadge';

export default function ProfileScreen() {
  const { user, logout, isLoading } = useAuth();
  const alert = useAlert();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [fitnessLevel, setFitnessLevel] = useState<string>('beginner');

  useEffect(() => {
    loadFitnessLevel();
  }, [user]);

  // Refresh fitness level when tab comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadFitnessLevel();
    }, [user])
  );

  const loadFitnessLevel = async () => {
    if (!user) return;

    try {
      console.log('💪 [PROFILE] Loading fitness level from assessment...');
      const fitnessAssessment = await authService.getFitnessAssessment();

      if (fitnessAssessment && fitnessAssessment.length > 0) {
        const assessmentFitnessLevel = fitnessAssessment[0].assessment_data.fitness_level;
        setFitnessLevel(assessmentFitnessLevel || 'beginner');
        console.log('💪 [PROFILE] Using fitness level from assessment:', assessmentFitnessLevel);
      } else {
        // Fallback to user profile fitness level
        setFitnessLevel(user.fitnessLevel || 'beginner');
        console.log('💪 [PROFILE] Using fitness level from user profile:', user.fitnessLevel);
      }
    } catch (error) {
      console.error('Error loading fitness level:', error);
      setFitnessLevel(user.fitnessLevel || 'beginner');
    }
  };

  // Get status bar height for Android
  const getStatusBarHeight = () => {
    if (Platform.OS === 'android') {
      return StatusBar.currentHeight || 24;
    }
    return 0;
  };

  const menuItems = [
    {
      section: 'Profile',
      items: [
        {
          icon: 'person-outline',
          title: 'Edit Profile',
          subtitle: 'Update your personal information',
          onPress: () => {
            router.push('/settings/edit-profile');
          },
        },
        {
          icon: 'settings-outline',
          title: 'User Personalization',
          subtitle: 'Customize your workout preferences',
          onPress: () => {
            router.push('/settings/user-personalization');
          },
        },
        {
          icon: 'trophy-outline',
          title: 'Achievements',
          subtitle: 'View your badges and progress',
          onPress: () => router.push('/achievements'),
        },
      ],
    },
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

  const handleLogout = () => {
    alert.confirm(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      performLogout,
      undefined,
      'Sign Out',
      'Cancel'
    );
  };

  const performLogout = async () => {
    try {
      setIsLoggingOut(true);
      console.log('🔥 Profile - Starting clean logout...');
      console.log('👤 Current user:', user?.email);

      await logout();

      console.log('✅ Profile - Logout completed, forcing navigation to login');
      // Force immediate navigation to login screen
      router.replace('/(auth)/splash');
    } catch (error) {
      console.error('❌ Profile - Logout failed:', error);
      alert.error('Logout Failed', 'There was an error signing you out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getUserDisplayData = () => {
    if (!user) {
      return {
        name: 'User',
        role: 'Unknown',
        details: 'Loading...',
      };
    }

    const name = capitalizeFirstLetter(user.firstName) || 'User';
    const role = user.role === 'mentor' ? 'Mentor' : 'Member';
    const details = `${fitnessLevel.charAt(0).toUpperCase() + fitnessLevel.slice(1)} Level • Tabata Training`;

    return { name, role, details };
  };

  const userDisplay = getUserDisplayData();
  const showLoading = isLoading || isLoggingOut;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* FIXED HEADER - OUTSIDE SCROLLVIEW */}
      <View
        style={[
          styles.header,
          {
            paddingTop:
              Platform.OS === 'android' ? getStatusBarHeight() + 16 : 16,
          },
        ]}
      >
        <Text style={styles.headerTitle}>Menu</Text>
      </View>

      {/* SCROLLABLE CONTENT ONLY */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* User Profile Card */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={showLoading}
            onPress={() => router.push('/profile/user-profile')}
          >
            <View style={styles.profileCard}>
              <View style={styles.profileContent}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={28} color="white" />
                </View>
                <View style={styles.profileInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={styles.profileName}>{userDisplay.name}</Text>
                    <FitnessLevelBadge level={fitnessLevel} size="small" />
                  </View>
                  <Text style={styles.profileRole}>
                    {userDisplay.role} • BMI: 24.2
                  </Text>
                  <Text style={styles.profileDetails}>
                    {userDisplay.details}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

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
                      itemIndex !== section.items.length - 1 && styles.menuItemBorder
                    ]}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                    disabled={showLoading}
                  >
                    <View style={styles.menuIcon}>
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color="#6B7280"
                      />
                    </View>
                    <View style={styles.menuContent}>
                      <Text style={styles.menuTitle}>
                        {item.title}
                      </Text>
                      <Text style={styles.menuSubtitle}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={[
              styles.logoutButton,
              showLoading && styles.logoutButtonDisabled
            ]}
            onPress={handleLogout}
            activeOpacity={0.7}
            disabled={showLoading}
          >
            {isLoggingOut ? (
              <>
                <ActivityIndicator size="small" color="#EF4444" />
                <Text style={styles.logoutText}>
                  Signing Out...
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                <Text style={styles.logoutText}>
                  Sign Out
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionSection}>
          <Text style={styles.versionText}>
            FitNEase v1.0.0
          </Text>
          <Text style={styles.versionText}>
            Tabata Training • Content-Based Filtering
          </Text>
          {__DEV__ && user && (
            <Text style={styles.debugText}>
              Logged in as: {user.email}
            </Text>
          )}
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
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  profileSection: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  profileRole: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    marginTop: 2,
  },
  profileDetails: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
    marginTop: 4,
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
  logoutSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  logoutButtonDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  logoutText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#EF4444',
    marginLeft: 8,
  },
  versionSection: {
    alignItems: 'center',
    paddingBottom: 32,
  },
  versionText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  debugText: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    color: '#D1D5DB',
    textAlign: 'center',
    marginTop: 4,
  },
});