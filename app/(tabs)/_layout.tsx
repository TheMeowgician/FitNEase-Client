import React, { useRef, useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import {
  Platform,
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../constants/colors';
import { GlobalLobbyIndicator } from '../../components/lobby/GlobalLobbyIndicator';
import { NetworkBanner } from '../../components/ui/NetworkBanner';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TAB_BLUE = '#6184FB';
const HIDDEN_TABS = ['workouts', 'weekly-plan'];
const TAB_INACTIVE = '#9CA3AF';
const PILL_WIDTH = 52;
const PILL_HEIGHT = 48;

// Icon config for each visible tab
const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  index: { active: 'home', inactive: 'home-outline' },
  groups: { active: 'people', inactive: 'people-outline' },
  progress: { active: 'analytics', inactive: 'analytics-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

function CustomTabBar({
  state,
  descriptors,
  navigation,
  isMentor,
  unreadCount,
}: BottomTabBarProps & { isMentor: boolean; unreadCount: number }) {
  const insets = useSafeAreaInsets();

  // Filter to only visible routes (exclude hidden tabs by name)
  const visibleRoutes = state.routes.filter(
    (route) => !HIDDEN_TABS.includes(route.name)
  );

  // Map visible index to state index for correct isFocused check
  const activeVisibleIndex = visibleRoutes.findIndex(
    (route) => route.key === state.routes[state.index]?.key
  );

  // Tab position tracking
  const [tabPositions, setTabPositions] = useState<{ x: number; width: number }[]>([]);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const scaleAnims = useRef(visibleRoutes.map(() => new Animated.Value(1))).current;

  // Animate indicator when active tab changes
  useEffect(() => {
    if (tabPositions.length > 0 && activeVisibleIndex >= 0 && tabPositions[activeVisibleIndex]) {
      const targetX = tabPositions[activeVisibleIndex].x +
        (tabPositions[activeVisibleIndex].width - PILL_WIDTH) / 2;

      Animated.spring(indicatorX, {
        toValue: targetX,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start();

      // Scale animation for icons
      scaleAnims.forEach((anim, i) => {
        Animated.spring(anim, {
          toValue: i === activeVisibleIndex ? 1.12 : 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [activeVisibleIndex, tabPositions]);

  const handleTabLayout = (index: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setTabPositions((prev) => {
      const updated = [...prev];
      updated[index] = { x, width };
      return updated;
    });
  };

  const bottomOffset = Platform.OS === 'ios'
    ? Math.max(20, insets.bottom)
    : Math.max(16, insets.bottom + 8);

  return (
    <View style={[barStyles.container, { bottom: bottomOffset }]}>
      {/* Animated sliding pill indicator */}
      {tabPositions.length === visibleRoutes.length && activeVisibleIndex >= 0 && (
        <Animated.View
          style={[
            barStyles.indicator,
            { transform: [{ translateX: indicatorX }] },
          ]}
        />
      )}

      {visibleRoutes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = activeVisibleIndex === index;
        const routeName = route.name;

        // Get icon names
        let iconActive = TAB_ICONS[routeName]?.active || 'ellipse';
        let iconInactive = TAB_ICONS[routeName]?.inactive || 'ellipse-outline';

        // Mentor override for home tab
        if (routeName === 'index' && isMentor) {
          iconActive = 'school';
          iconInactive = 'school-outline';
        }

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.7}
            style={barStyles.tab}
            onLayout={(e) => handleTabLayout(index, e)}
          >
            <Animated.View
              style={[
                barStyles.iconWrap,
                { transform: [{ scale: scaleAnims[index] }] },
              ]}
            >
              <Ionicons
                name={(isFocused ? iconActive : iconInactive) as any}
                size={24}
                color={isFocused ? TAB_BLUE : TAB_INACTIVE}
              />
              {/* Notification badge on Home tab */}
              {routeName === 'index' && unreadCount > 0 && (
                <View style={barStyles.badge}>
                  <Text style={barStyles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </Animated.View>
            {/* Active dot */}
            {isFocused && <View style={barStyles.activeDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  indicator: {
    position: 'absolute',
    top: (64 - PILL_HEIGHT) / 2,
    left: 0,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 64,
  },
  iconWrap: {
    position: 'relative',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: TAB_BLUE,
    marginTop: 4,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
});

export default function TabLayout() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const isMentor = user?.role === 'mentor';

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => (
          <CustomTabBar {...props} isMentor={isMentor} unreadCount={unreadCount} />
        )}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: isMentor ? 'Dashboard' : 'Home',
          }}
        />
        <Tabs.Screen
          name="workouts"
          options={{
            title: 'Workouts',
            href: null,
          }}
        />
        <Tabs.Screen
          name="weekly-plan"
          options={{
            title: 'Weekly Plan',
            href: null,
          }}
        />
        <Tabs.Screen
          name="groups"
          options={{
            title: 'Groups',
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
          }}
        />
      </Tabs>
      <GlobalLobbyIndicator />
      <NetworkBanner />
    </View>
  );
}
