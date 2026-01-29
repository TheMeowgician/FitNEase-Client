import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, User as AuthUser, LoginRequest, RegisterRequest } from '../services/microservices/authService';
import { workoutNotificationScheduler, NotificationSettings } from '../services/workoutNotificationScheduler';

const NOTIFICATION_SETTINGS_KEY = '@notification_settings';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  onboardingCompleted: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: RegisterRequest) => Promise<{ requiresEmailVerification: boolean; user?: AuthUser }>;
  logout: () => Promise<void>;
  verifyEmail: (code: string, email?: string) => Promise<void>;
  resendVerification: (email?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;
  const isEmailVerified = !!user?.isEmailVerified;
  const onboardingCompleted = !!user?.onboardingCompleted;

  // Debug logging
  useEffect(() => {
    if (user) {
      console.log('🔍 User state updated:', {
        id: user.id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        onboardingCompleted: user.onboardingCompleted,
        role: user.role
      });
    }
  }, [user]);

  useEffect(() => {
    // Initialize auth state - check for stored tokens, etc.
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Check if user is already authenticated
      const isAuth = await authService.isAuthenticated();
      if (isAuth) {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);

        // Schedule workout reminders for returning user
        scheduleWorkoutRemindersForUser(currentUser);
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      // Clear any invalid tokens
      await authService.logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      console.log('🔑 Starting login process...');
      const loginData: LoginRequest = { email: email.trim().toLowerCase(), password };
      const response = await authService.login(loginData);

      console.log('🔑 Setting user in AuthContext:', response.user);
      setUser(response.user);

      // Small delay to ensure state propagates
      await new Promise(resolve => setTimeout(resolve, 100));

      // Schedule workout reminders if user has workout days configured
      scheduleWorkoutRemindersForUser(response.user);

      console.log('🔑 Login completed, user set');
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Schedule workout reminders for a user based on their workout days
   * Reads the user's saved notification settings from AsyncStorage
   */
  const scheduleWorkoutRemindersForUser = async (userData: AuthUser) => {
    try {
      if (userData.workoutDays && userData.workoutDays.length > 0) {
        console.log('📅 Scheduling workout reminders for days:', userData.workoutDays);

        // Read saved notification settings from AsyncStorage
        let settings: NotificationSettings = {
          enabled: true,
          morningReminderTime: '08:00',
          advanceNoticeMinutes: 60,
        };

        try {
          const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
          if (stored) {
            const savedSettings = JSON.parse(stored);
            settings = { ...settings, ...savedSettings };
            console.log('📅 Using saved notification time:', settings.morningReminderTime);
          }
        } catch (storageError) {
          console.log('📅 Could not read notification settings, using defaults');
        }

        // If notifications are disabled, don't schedule
        if (!settings.enabled) {
          console.log('📅 Notifications disabled in settings, skipping schedule');
          return;
        }

        // Convert day IDs to proper day names (capitalize first letter)
        const dayNames = userData.workoutDays.map((day: string) =>
          day.charAt(0).toUpperCase() + day.slice(1)
        );

        await workoutNotificationScheduler.scheduleWorkoutReminders(dayNames, settings);

        console.log('📅 Workout reminders scheduled successfully');
      } else {
        console.log('📅 No workout days configured, skipping reminder scheduling');
      }
    } catch (error) {
      console.error('📅 Failed to schedule workout reminders:', error);
      // Don't throw - scheduling failure shouldn't break login
    }
  };

  const register = async (userData: RegisterRequest): Promise<{ requiresEmailVerification: boolean; user?: AuthUser }> => {
    setIsLoading(true);
    try {
      const response = await authService.register(userData);

      // Set user in context if tokens were received (during login/verification)
      if (response.tokens && response.user) {
        setUser(response.user);
      }

      return {
        requiresEmailVerification: response.requiresEmailVerification,
        user: response.user || undefined
      };
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      console.log('🔓 AuthContext: Starting logout process...');
      await authService.logout();
      console.log('🔓 AuthContext: Server logout completed, clearing user state');
      setUser(null);
      console.log('🔓 AuthContext: User state cleared, navigation should trigger');
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear user state even if logout request fails
      console.log('🔓 AuthContext: Clearing user state despite logout error');
      setUser(null);
    }
  };

  const verifyEmail = async (code: string, email?: string): Promise<void> => {
    try {
      const userEmail = email || user?.email;
      if (!userEmail) {
        throw new Error('Email address is required for verification');
      }

      const response = await authService.verifyEmail({
        email: userEmail,
        token: code
      });

      // Backend now returns tokens and user data after verification
      // Automatically log in the user
      if (response.user && response.token) {
        console.log('✅ Email verified successfully! Auto-logging in user...');
        setUser(response.user);
        // Small delay to ensure state propagates
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        console.log('✅ Email verified. User needs to login to get tokens.');
      }
    } catch (error) {
      console.error('Email verification failed:', error);
      throw error;
    }
  };

  const resendVerification = async (email?: string): Promise<void> => {
    try {
      const userEmail = email || user?.email;
      await authService.resendVerificationEmail(userEmail);
    } catch (error) {
      console.error('Resend verification failed:', error);
      throw error;
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      if (await authService.isAuthenticated()) {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('User refresh failed:', error);
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    isEmailVerified,
    onboardingCompleted,
    login,
    register,
    logout,
    verifyEmail,
    resendVerification,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};