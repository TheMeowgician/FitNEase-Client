import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { GlobalLobbyIndicator } from '../../components/lobby/GlobalLobbyIndicator';
import { NetworkBanner } from '../../components/ui/NetworkBanner';
import { useAuth } from '../../contexts/AuthContext';

export default function TabLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isMentor = user?.role === 'mentor';

  // On Android, use the actual bottom inset (handles gesture nav bar) with a minimum of 8px
  const tabBarPaddingBottom = Platform.OS === 'ios' ? 20 : Math.max(8, insets.bottom);
  const tabBarHeight = Platform.OS === 'ios' ? 88 : 56 + tabBarPaddingBottom;

  return (
    <View style={{ flex: 1 }}>
      <NetworkBanner />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.PRIMARY[600],
        tabBarInactiveTintColor: COLORS.SECONDARY[400],
        tabBarStyle: {
          backgroundColor: COLORS.NEUTRAL.WHITE,
          borderTopWidth: 1,
          borderTopColor: COLORS.SECONDARY[200],
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isMentor ? 'Dashboard' : 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={isMentor ? (focused ? 'school' : 'school-outline') : (focused ? 'home' : 'home-outline')}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'fitness' : 'fitness-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="weekly-plan"
        options={{
          title: 'Weekly Plan',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'analytics' : 'analytics-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      </Tabs>
      <GlobalLobbyIndicator />
    </View>
  );
}