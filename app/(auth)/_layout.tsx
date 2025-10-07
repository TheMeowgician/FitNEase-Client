import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

export default function AuthLayout() {
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: styles.content,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="splash"
          options={{
            title: 'Splash',
            gestureEnabled: false, // Prevent back gesture on splash
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            title: 'Login',
          }}
        />
        <Stack.Screen
          name="register"
          options={{
            title: 'Create Account',
          }}
        />
        <Stack.Screen
          name="verify-email"
          options={{
            title: 'Verify Email',
            gestureEnabled: false, // Prevent back gesture
          }}
        />
        <Stack.Screen
          name="resend-verification"
          options={{
            title: 'Resend Verification',
          }}
        />
        <Stack.Screen
          name="forgot-password"
          options={{
            title: 'Reset Password',
          }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  content: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
});