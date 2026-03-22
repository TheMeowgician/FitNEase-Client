import { apiClient, ApiResponse } from '../api/client';
import { tokenManager, TokenPair } from '../auth/tokenManager';

export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  isEmailVerified: boolean;
  onboardingCompleted?: boolean;
  profilePicture?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  height?: number;
  weight?: number;
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  goals?: string[];
  preferences?: UserPreferences;
  role?: 'member' | 'mentor';
  createdAt: string;
  updatedAt: string;
  // User Personalization fields
  targetMuscleGroups?: string[];
  availableEquipment?: string[];
  timeConstraints?: number;
  activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  workoutExperience?: number;
  phoneNumber?: string;
  workoutDays?: string[]; // ['monday', 'tuesday', etc.]
  // User Progression fields
  totalWorkoutsCompleted?: number;
  totalWorkoutMinutes?: number;
  activeDays?: number;
  currentStreakDays?: number;
  longestStreakDays?: number;
}

export interface UserPreferences {
  units: 'metric' | 'imperial';
  language: string;
  timezone: string;
  notifications: {
    workouts: boolean;
    social: boolean;
    achievements: boolean;
    reminders: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'friends' | 'private';
    workoutVisibility: 'public' | 'friends' | 'private';
    achievementVisibility: 'public' | 'friends' | 'private';
  };
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: User;
  tokens: TokenPair;
  message: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  phoneNumber?: string;
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  goals?: string[];
  role?: 'member' | 'mentor';
}

export interface RegisterResponse {
  user?: User;
  tokens?: TokenPair;
  message: string;
  user_id?: string;
  requiresEmailVerification: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  email: string;
  token: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  tokens: TokenPair;
  user?: User;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  username?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  height?: number;
  weight?: number;
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  goals?: string[];
  profilePicture?: string;
}

export interface UpdatePreferencesRequest {
  preferences: Partial<UserPreferences>;
}

export interface DeleteAccountRequest {
  password: string;
  reason?: string;
}

export class AuthService {
  public async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await apiClient.post('auth', '/api/auth/login', credentials);
      const rawData = response.data;

      console.log('🔍 Raw login response:', rawData);

      // Transform Laravel response to frontend format
      const tokens = {
        accessToken: rawData.token,
        refreshToken: rawData.token, // Laravel Sanctum uses same token for both
      };

      // Transform user data from snake_case to camelCase
      const transformedUser: User = {
        id: rawData.user.user_id?.toString() || '',
        email: rawData.user.email,
        username: rawData.user.username,
        firstName: rawData.user.first_name,
        lastName: rawData.user.last_name,
        isEmailVerified: !!rawData.user.email_verified_at,
        onboardingCompleted: !!rawData.user.onboarding_completed,
        profilePicture: rawData.user.profile_picture,
        dateOfBirth: rawData.user.date_of_birth,
        gender: rawData.user.gender,
        height: rawData.user.height,
        weight: rawData.user.weight,
        fitnessLevel: rawData.user.fitness_level,
        goals: rawData.user.fitness_goals || [],
        role: rawData.user.role,
        createdAt: rawData.user.created_at,
        updatedAt: rawData.user.updated_at,
        // User Personalization fields
        targetMuscleGroups: rawData.user.target_muscle_groups || [],
        availableEquipment: rawData.user.available_equipment || [],
        timeConstraints: rawData.user.time_constraints_minutes,
        activityLevel: rawData.user.activity_level,
        workoutExperience: rawData.user.workout_experience_years,
        phoneNumber: rawData.user.phone_number,
        workoutDays: rawData.user.preferred_workout_days || [],
      };

      console.log('✅ Transformed user:', transformedUser);

      if (tokens.accessToken) {
        await tokenManager.updateTokensWithAutoMetadata(tokens);
      }

      return {
        user: transformedUser,
        tokens: tokens,
        message: 'Login successful'
      };
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw new Error((error as any).message || 'Login failed');
    }
  }

  public async register(userData: RegisterRequest): Promise<RegisterResponse> {
    try {
      // Calculate age from date of birth
      let age: number | undefined;
      if (userData.dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(userData.dateOfBirth);
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }

      // Map fitness level values to Laravel expectations
      let mappedFitnessLevel: string | undefined;
      if (userData.fitnessLevel) {
        const fitnessLevelMap: Record<string, string> = {
          'beginner': 'beginner',
          'intermediate': 'medium',
          'advanced': 'expert'
        };
        mappedFitnessLevel = fitnessLevelMap[userData.fitnessLevel] || 'beginner';
      }

      // Transform field names for Laravel backend
      const transformedData: any = {
        email: userData.email,
        password: userData.password,
        username: userData.username,
        first_name: userData.firstName, // Laravel expects snake_case
        last_name: userData.lastName,   // Laravel expects snake_case
        age: age, // Laravel requires age as integer
        gender: userData.gender,
        fitness_level: mappedFitnessLevel, // Laravel expects: beginner, medium, expert
        activity_level: 'moderately_active', // Default activity level
        fitness_goals: userData.goals || [], // Map goals to fitness_goals array
        date_of_birth: userData.dateOfBirth, // Include dateOfBirth if provided
        phone_number: userData.phoneNumber, // Map phoneNumber to snake_case
        role: userData.role || 'member', // Include role (default to member)
      };

      // Remove undefined/empty values, but keep age if it's calculated
      Object.keys(transformedData).forEach(key => {
        const value = transformedData[key as keyof typeof transformedData];
        // Don't remove age even if it's undefined - Laravel validation will handle it
        if (key !== 'age' && (value === undefined || value === null || value === '')) {
          delete transformedData[key as keyof typeof transformedData];
        }
      });

      // If age is undefined but date_of_birth exists, set a default age for validation
      if (!transformedData.age && transformedData.date_of_birth) {
        // Default to 25 if age calculation failed
        transformedData.age = 25;
      }

      console.log('Sending to backend:', transformedData);

      const response = await apiClient.post('auth', '/api/auth/register', transformedData);

      console.log('Full backend response:', response);
      console.log('Backend registration response data:', response?.data);

      if (!response) {
        throw new Error('No response received from auth service');
      }

      if (!response.data) {
        throw new Error('Empty response data from auth service');
      }

      const rawData = response.data;
      console.log(`🔖 User registered with role: ${userData.role || 'member'}`);

      // Store token (same pattern as login — Sanctum single token)
      let tokens: TokenPair | null = null;
      if (rawData.token) {
        tokens = {
          accessToken: rawData.token,
          refreshToken: rawData.token,
        };
        await tokenManager.updateTokensWithAutoMetadata(tokens);
        console.log('✅ Registration token saved to storage');
      }

      // Transform user data from snake_case to camelCase (same as login)
      let transformedUser: User | null = null;
      if (rawData.user) {
        transformedUser = {
          id: rawData.user.user_id?.toString() || '',
          email: rawData.user.email,
          username: rawData.user.username,
          firstName: rawData.user.first_name,
          lastName: rawData.user.last_name,
          isEmailVerified: !!rawData.user.email_verified_at,
          onboardingCompleted: !!rawData.user.onboarding_completed,
          profilePicture: rawData.user.profile_picture,
          dateOfBirth: rawData.user.date_of_birth,
          gender: rawData.user.gender,
          height: rawData.user.height,
          weight: rawData.user.weight,
          fitnessLevel: rawData.user.fitness_level,
          goals: rawData.user.fitness_goals || [],
          role: rawData.user.role,
          createdAt: rawData.user.created_at,
          updatedAt: rawData.user.updated_at,
          targetMuscleGroups: rawData.user.target_muscle_groups || [],
          availableEquipment: rawData.user.available_equipment || [],
          timeConstraints: rawData.user.time_constraints_minutes,
          activityLevel: rawData.user.activity_level,
          workoutExperience: rawData.user.workout_experience_years,
          phoneNumber: rawData.user.phone_number,
          workoutDays: rawData.user.preferred_workout_days || [],
        };
      }

      return {
        user: transformedUser,
        tokens: tokens,
        message: rawData?.message || 'Registration completed',
        user_id: rawData?.user_id,
        requiresEmailVerification: true
      };
    } catch (error) {
      console.error('Registration API error:', error);

      // Parse Laravel validation errors or general errors
      let errorMessage = 'Registration failed';

      if (error && (error as any).response && (error as any).response.data) {
        const responseData = (error as any).response.data;

        if (responseData.message) {
          errorMessage = responseData.message;
        } else if (responseData.errors) {
          // Handle Laravel validation errors
          const validationErrors = Object.values(responseData.errors).flat();
          errorMessage = validationErrors.join('. ');
        } else if (responseData.error) {
          errorMessage = responseData.error;
        }
      } else if ((error as any).message) {
        errorMessage = (error as any).message;
      }

      throw new Error(errorMessage);
    }
  }

  public async logout(): Promise<void> {
    try {
      // Use DELETE method as expected by Laravel backend
      await apiClient.delete('auth', '/api/auth/logout');
      console.log('✅ Server logout completed successfully');
    } catch (error) {
      // Silently handle logout errors - session may already be expired
      // This is expected behavior and doesn't indicate a problem
      const errorMessage = (error as any)?.message || '';
      if (errorMessage.includes('currentAccessToken') || errorMessage.includes('null')) {
        console.log('ℹ️ Session already cleared on server');
      } else {
        console.log('ℹ️ Server logout skipped:', errorMessage);
      }
    } finally {
      // Always clear local tokens regardless of server response
      await tokenManager.clearTokens();
      console.log('✅ Logout completed - local tokens cleared');
    }
  }

  public async forgotPassword(request: ForgotPasswordRequest): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('auth', '/api/auth/forgot-password', request);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to send password reset email');
    }
  }

  public async resetPassword(request: ResetPasswordRequest): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('auth', '/api/auth/reset-password', {
        email: request.email,
        code: request.code,
        new_password: request.newPassword,
      });
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Password reset failed');
    }
  }

  public async changePassword(request: ChangePasswordRequest): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('auth', '/auth/change-password', request);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Password change failed');
    }
  }

  public async verifyEmail(request: VerifyEmailRequest): Promise<{ message: string; user: User; token?: string; abilities?: string[]; expires_at?: string }> {
    try {
      // For 6-digit codes, use verify-code endpoint
      const response = await apiClient.post('auth', '/api/auth/verify-code', {
        email: request.email,
        code: request.token
      });

      const rawData = response.data;
      console.log('✅ Email verification response:', rawData);

      // If backend returns token (auto-login after verification), save it
      if (rawData.token) {
        const tokens = {
          accessToken: rawData.token,
          refreshToken: rawData.token, // Laravel Sanctum uses same token
        };

        await tokenManager.updateTokensWithAutoMetadata(tokens);
        console.log('✅ Verification tokens saved to storage');
      }

      // Transform user data from snake_case to camelCase
      const transformedUser: User = {
        id: rawData.user.user_id?.toString() || '',
        email: rawData.user.email,
        username: rawData.user.username,
        firstName: rawData.user.first_name,
        lastName: rawData.user.last_name,
        isEmailVerified: !!rawData.user.email_verified_at,
        onboardingCompleted: !!rawData.user.onboarding_completed,
        profilePicture: rawData.user.profile_picture,
        dateOfBirth: rawData.user.date_of_birth,
        gender: rawData.user.gender,
        height: rawData.user.height,
        weight: rawData.user.weight,
        fitnessLevel: rawData.user.fitness_level,
        goals: rawData.user.fitness_goals || [],
        role: rawData.user.role,
        createdAt: rawData.user.created_at,
        updatedAt: rawData.user.updated_at,
        // User Personalization fields
        targetMuscleGroups: rawData.user.target_muscle_groups || [],
        availableEquipment: rawData.user.available_equipment || [],
        timeConstraints: rawData.user.time_constraints_minutes,
        activityLevel: rawData.user.activity_level,
        workoutExperience: rawData.user.workout_experience_years,
        phoneNumber: rawData.user.phone_number,
        workoutDays: rawData.user.preferred_workout_days || [],
        // User Progression fields
        totalWorkoutsCompleted: rawData.user.total_workouts_completed,
        totalWorkoutMinutes: rawData.user.total_workout_minutes,
        activeDays: rawData.user.active_days,
        currentStreakDays: rawData.user.current_streak_days,
        longestStreakDays: rawData.user.longest_streak_days,
      };

      return {
        message: rawData.message,
        user: transformedUser,
        token: rawData.token,
        abilities: rawData.abilities,
        expires_at: rawData.expires_at
      };
    } catch (error) {
      throw new Error((error as any).message || 'Email verification failed');
    }
  }

  public async resendVerificationEmail(email?: string): Promise<{ message: string }> {
    try {
      const payload = email ? { email } : {};
      const response = await apiClient.post<{ message: string }>('auth', '/api/auth/resend-verification', payload);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to resend verification email');
    }
  }

  public async getVerificationCodeForDebug(email: string): Promise<{ email: string; verification_code: string; expires_at: string; is_expired: boolean }> {
    try {
      const response = await apiClient.get<{ email: string; verification_code: string; expires_at: string; is_expired: boolean }>('auth', `/api/auth/debug-verification-code/${encodeURIComponent(email)}`);
      console.log('Debug verification code response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to get debug verification code:', error);
      throw new Error((error as any).message || 'Failed to get verification code');
    }
  }

  public async getUserStatusForDebug(email: string): Promise<{ email: string; username: string; is_verified: boolean; email_verified_at: string | null; has_verification_code: boolean; verification_code: string | null; code_expires_at: string | null; code_is_expired: boolean | null; created_at: string }> {
    try {
      const response = await apiClient.get('auth', `/api/auth/debug-user-status/${encodeURIComponent(email)}`);
      console.log('Debug user status full response:', response);
      console.log('Debug user status response data:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to get debug user status:', error);
      throw new Error((error as any).message || 'Failed to get user status');
    }
  }

  public async resetVerificationForDebug(email: string): Promise<{ message: string; email: string; new_verification_code: string; expires_at: string }> {
    try {
      const response = await apiClient.post('auth', `/api/auth/debug-reset-verification/${encodeURIComponent(email)}`);
      console.log('Debug reset verification full response:', response);
      console.log('Debug reset verification response data:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to reset verification for debug:', error);
      throw new Error((error as any).message || 'Failed to reset verification');
    }
  }

  public async refreshToken(): Promise<RefreshTokenResponse> {
    try {
      const refreshToken = await tokenManager.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiClient.post<RefreshTokenResponse>('auth', '/auth/refresh', {
        refreshToken
      });

      if (response.data.tokens) {
        await tokenManager.updateTokensWithAutoMetadata(response.data.tokens);
      }

      return response.data;
    } catch (error) {
      await tokenManager.clearTokens();
      throw new Error((error as any).message || 'Token refresh failed');
    }
  }

  public async getCurrentUser(): Promise<User> {
    try {
      const response = await apiClient.get('auth', '/api/auth/user');
      const rawData = response.data;

      console.log('📋 Raw getCurrentUser response:', rawData);

      // Transform user data from snake_case to camelCase
      const transformedUser: User = {
        id: rawData.user_id?.toString() || '',
        email: rawData.email,
        username: rawData.username,
        firstName: rawData.first_name,
        lastName: rawData.last_name,
        isEmailVerified: !!rawData.email_verified_at,
        onboardingCompleted: !!rawData.onboarding_completed,
        profilePicture: rawData.profile_picture,
        dateOfBirth: rawData.date_of_birth,
        gender: rawData.gender,
        height: rawData.height,
        weight: rawData.weight,
        fitnessLevel: rawData.fitness_level,
        goals: rawData.fitness_goals || [],
        role: rawData.role,
        createdAt: rawData.created_at,
        updatedAt: rawData.updated_at,
        // User Personalization fields
        targetMuscleGroups: rawData.target_muscle_groups || [],
        availableEquipment: rawData.available_equipment || [],
        timeConstraints: rawData.time_constraints_minutes,
        activityLevel: rawData.activity_level,
        workoutExperience: rawData.workout_experience_years,
        phoneNumber: rawData.phone_number,
        workoutDays: rawData.preferred_workout_days || [],
      };

      console.log('✅ Transformed user from getCurrentUser:', transformedUser);
      return transformedUser;
    } catch (error) {
      console.error('❌ getCurrentUser failed:', error);
      throw new Error((error as any).message || 'Failed to get current user');
    }
  }

  public async updateProfile(updates: UpdateProfileRequest): Promise<User> {
    try {
      // Get current user to get user ID
      const currentUser = await this.getCurrentUser();

      // Transform updates to match Laravel expectations
      const transformedUpdates: any = { ...updates };

      // Map fitness level values to Laravel expectations (same as registration)
      if (transformedUpdates.fitnessLevel) {
        const fitnessLevelMap: Record<string, string> = {
          'beginner': 'beginner',
          'intermediate': 'medium',
          'advanced': 'expert'
        };
        transformedUpdates.fitness_level = fitnessLevelMap[transformedUpdates.fitnessLevel] || 'beginner';
        delete transformedUpdates.fitnessLevel; // Remove the camelCase version
      }

      const response = await apiClient.put<User>('auth', `/api/auth/user-profile/${currentUser.id}`, transformedUpdates);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Profile update failed');
    }
  }

  public async updatePreferences(request: UpdatePreferencesRequest): Promise<UserPreferences> {
    try {
      const response = await apiClient.put<UserPreferences>('auth', '/auth/preferences', request);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Preferences update failed');
    }
  }

  public async getPreferences(): Promise<UserPreferences> {
    try {
      const response = await apiClient.get<UserPreferences>('auth', '/auth/preferences');
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get preferences');
    }
  }

  public async deleteAccount(request: DeleteAccountRequest): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<{ message: string }>('auth', '/auth/account', {
        data: request
      });

      await tokenManager.clearTokens();
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Account deletion failed');
    }
  }

  public async uploadProfilePicture(imageUri: string): Promise<{ profilePictureUrl: string }> {
    try {
      const { mediaService } = await import('./mediaService');

      // Step 1: Upload image file to media service
      const uploadResponse = await mediaService.uploadProfilePicture(imageUri);
      const relativeUrl = uploadResponse.data.url;

      // Step 2: Update auth service with the relative URL (retry up to 2 times)
      // This is critical — if this fails, DB points to old/deleted file
      const currentUser = await this.getCurrentUser();
      let lastError: any;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await apiClient.put('auth', `/api/auth/user-profile/${currentUser.id}`, {
            profile_picture: relativeUrl,
          });
          return { profilePictureUrl: relativeUrl };
        } catch (err) {
          lastError = err;
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          }
        }
      }

      throw new Error(lastError?.message || 'Failed to save profile picture after upload');
    } catch (error) {
      throw new Error((error as any).message || 'Profile picture upload failed');
    }
  }

  public async removeProfilePicture(): Promise<{ message: string }> {
    try {
      const currentUser = await this.getCurrentUser();
      await apiClient.put('auth', `/api/auth/user-profile/${currentUser.id}`, {
        profile_picture: null,
      });
      return { message: 'Profile picture removed successfully' };
    } catch (error) {
      throw new Error((error as any).message || 'Profile picture removal failed');
    }
  }

  public async checkEmailAvailability(email: string): Promise<{ available: boolean }> {
    try {
      const response = await apiClient.get<{ available: boolean }>('auth', `/auth/check-email?email=${encodeURIComponent(email)}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Email availability check failed');
    }
  }

  public async checkUsernameAvailability(username: string): Promise<{ available: boolean }> {
    try {
      const response = await apiClient.get<{ available: boolean }>('auth', `/auth/check-username?username=${encodeURIComponent(username)}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Username availability check failed');
    }
  }

  public async searchUserByUsername(username: string): Promise<{ id: number; username: string; email: string } | null> {
    try {
      const response = await apiClient.get<{ data: Array<{ user_id: number; username: string; email: string }> }>('auth', `/api/all-users?search=${encodeURIComponent(username)}`);

      if (!response.data || !response.data.data || response.data.data.length === 0) {
        return null;
      }

      // Get the first matching user and transform to expected format
      const user = response.data.data[0];
      return {
        id: user.user_id,
        username: user.username,
        email: user.email,
      };
    } catch (error) {
      console.error('Search user by username failed:', error);
      return null;
    }
  }

  public async validateToken(): Promise<{ valid: boolean; user?: User }> {
    try {
      // Use the user endpoint to validate token - if it succeeds, token is valid
      const user = await this.getCurrentUser();
      return { valid: true, user };
    } catch (error) {
      console.log('🔍 Token validation failed, clearing tokens:', error);
      // Clear invalid tokens
      await tokenManager.clearTokens();
      return { valid: false };
    }
  }

  public async getTwoFactorSettings(): Promise<{ enabled: boolean; backupCodes?: string[] }> {
    try {
      const response = await apiClient.get<{ enabled: boolean; backupCodes?: string[] }>('auth', '/auth/2fa');
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get 2FA settings');
    }
  }

  public async enableTwoFactor(): Promise<{ qrCode: string; secret: string; backupCodes: string[] }> {
    try {
      const response = await apiClient.post<{ qrCode: string; secret: string; backupCodes: string[] }>('auth', '/auth/2fa/enable');
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to enable 2FA');
    }
  }

  public async verifyTwoFactor(code: string): Promise<{ verified: boolean; backupCodes?: string[] }> {
    try {
      const response = await apiClient.post<{ verified: boolean; backupCodes?: string[] }>('auth', '/auth/2fa/verify', { code });
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || '2FA verification failed');
    }
  }

  public async disableTwoFactor(password: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('auth', '/auth/2fa/disable', { password });
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to disable 2FA');
    }
  }

  public async generateNewBackupCodes(): Promise<{ backupCodes: string[] }> {
    try {
      const response = await apiClient.post<{ backupCodes: string[] }>('auth', '/auth/2fa/backup-codes');
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to generate backup codes');
    }
  }

  public async getLoginHistory(page = 1, limit = 20): Promise<{
    history: Array<{
      id: string;
      deviceInfo: string;
      location: string;
      ipAddress: string;
      timestamp: string;
      success: boolean;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const response = await apiClient.get<{
        history: Array<{
          id: string;
          deviceInfo: string;
          location: string;
          ipAddress: string;
          timestamp: string;
          success: boolean;
        }>;
        total: number;
        page: number;
        limit: number;
      }>('auth', `/auth/login-history?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get login history');
    }
  }

  public async revokeAllSessions(): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('auth', '/auth/revoke-sessions');
      await tokenManager.clearTokens();
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to revoke sessions');
    }
  }

  public async isAuthenticated(): Promise<boolean> {
    try {
      const hasTokens = await tokenManager.hasValidTokens();
      if (!hasTokens) {
        return false;
      }

      const validation = await this.validateToken();
      return validation.valid;
    } catch (error) {
      return false;
    }
  }

  public async ensureAuthenticated(): Promise<void> {
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      throw new Error('Authentication required');
    }
  }

  public async getAuthStatus(): Promise<{
    isAuthenticated: boolean;
    user?: User;
    tokenInfo: any;
  }> {
    try {
      const tokenInfo = await tokenManager.debugTokenInfo();
      const isAuth = await this.isAuthenticated();
      let user: User | undefined;

      if (isAuth) {
        try {
          user = await this.getCurrentUser();
        } catch (error) {
          console.warn('Failed to get current user:', error);
        }
      }

      return {
        isAuthenticated: isAuth,
        user,
        tokenInfo
      };
    } catch (error) {
      return {
        isAuthenticated: false,
        tokenInfo: { error: (error as any).message }
      };
    }
  }

  // Onboarding API methods
  public async saveFitnessAssessment(assessmentData: {
    assessment_type: string;
    assessment_data: any;
    score: number;
  }): Promise<{ message: string }> {
    try {
      // Get current user to include user_id in the payload
      const currentUser = await this.getCurrentUser();

      const payload = {
        ...assessmentData,
        user_id: parseInt(currentUser.id), // Laravel expects numeric user_id
      };

      console.log('💾 Sending fitness assessment with user_id:', payload);

      const response = await apiClient.post<{ message: string }>('auth', '/api/fitness-assessment', payload);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to save fitness assessment');
    }
  }

  public async updateUserProfile(profileData: {
    target_muscle_groups?: string[];
    available_equipment?: string[];
    time_constraints_minutes?: number;
    preferred_workout_types?: string[];
    preferred_workout_days?: string[];
    fitness_goals?: string[];
    activity_level?: string;
    medical_conditions?: string;
    workout_experience_years?: number;
    age?: number;
    onboarding_completed?: boolean;
  }): Promise<User> {
    try {
      // Get current user to get user ID for the existing route
      const currentUser = await this.getCurrentUser();
      const response = await apiClient.put<User>('auth', `/api/auth/user-profile/${currentUser.id}`, profileData);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to update user profile');
    }
  }

  public async initializeMLProfile(): Promise<{ message: string }> {
    try {
      // ML profile initialization - this is a non-critical service call
      // Skip if the service is not available or has auth issues
      const response = await apiClient.put<{ message: string }>('auth', '/api/users/initialize-ml-profile', {});
      console.log('✅ ML profile initialized successfully');
      return response.data;
    } catch (error) {
      const errorMessage = (error as any)?.message || 'Unknown error';

      // Check if it's an auth ability error or service unavailable
      if (errorMessage.includes('Invalid ability') || errorMessage.includes('ml service error')) {
        console.warn('⚠️ ML service unavailable or auth issue - skipping ML profile initialization:', errorMessage);
      } else {
        console.warn('⚠️ ML profile initialization failed:', errorMessage);
      }

      // Always return success to prevent blocking the auth flow
      return { message: 'ML profile initialization skipped due to service unavailability' };
    }
  }

  // Get user's fitness assessment data (including personalization)
  public async getFitnessAssessment(userId?: number | string): Promise<any> {
    try {
      // Build the endpoint - filter by user_id if provided
      const endpoint = userId
        ? `/api/fitness-assessments?user_id=${userId}`
        : '/api/fitness-assessments';

      const response = await apiClient.get('auth', endpoint);
      // API returns paginated data, we want the data array
      return response.data?.data || response.data;
    } catch (error) {
      console.warn('⚠️ Could not fetch fitness assessment:', error);
      return null;
    }
  }

  // Update existing fitness assessment
  public async updateFitnessAssessment(assessmentId: number, updates: {
    assessment_data?: any;
    score?: number;
  }): Promise<any> {
    try {
      const response = await apiClient.put('auth', `/api/fitness-assessments/${assessmentId}`, updates);
      return response.data;
    } catch (error) {
      console.warn('⚠️ Could not update fitness assessment:', error);
      throw new Error((error as any).message || 'Failed to update fitness assessment');
    }
  }

  // Check if user has submitted weekly assessment this week
  public async getWeeklyAssessmentStatus(): Promise<{
    completed_this_week: boolean;
    week_start: string;
    week_end: string;
    this_week_assessment: {
      id: number;
      submitted_at: string;
      score: number;
    } | null;
    last_assessment: {
      id: number;
      submitted_at: string;
      score: number;
    } | null;
  }> {
    try {
      const response = await apiClient.get('auth', '/api/weekly-assessment-status');
      return response.data;
    } catch (error) {
      console.warn('⚠️ Could not get weekly assessment status:', error);
      // Return default status if check fails
      return {
        completed_this_week: false,
        week_start: new Date().toISOString(),
        week_end: new Date().toISOString(),
        this_week_assessment: null,
        last_assessment: null,
      };
    }
  }

  // Get member profile by ID (for mentor dashboard)
  public async getMemberProfile(userId: string): Promise<User | null> {
    try {
      const response = await apiClient.get('auth', `/api/auth/user-profile/${userId}`);
      const rawData = response.data;

      console.log('📋 Raw getMemberProfile response:', rawData);

      // Transform user data from snake_case to camelCase
      const transformedUser: User = {
        id: rawData.user_id?.toString() || '',
        email: rawData.email,
        username: rawData.username,
        firstName: rawData.first_name,
        lastName: rawData.last_name,
        isEmailVerified: !!rawData.email_verified_at,
        onboardingCompleted: !!rawData.onboarding_completed,
        profilePicture: rawData.profile_picture,
        dateOfBirth: rawData.date_of_birth,
        gender: rawData.gender,
        height: rawData.height,
        weight: rawData.weight,
        fitnessLevel: rawData.fitness_level,
        goals: rawData.fitness_goals || [],
        role: rawData.role,
        createdAt: rawData.created_at,
        updatedAt: rawData.updated_at,
        targetMuscleGroups: rawData.target_muscle_groups || [],
        availableEquipment: rawData.available_equipment || [],
        timeConstraints: rawData.time_constraints_minutes,
        activityLevel: rawData.activity_level,
        workoutExperience: rawData.workout_experience_years,
        phoneNumber: rawData.phone_number,
        workoutDays: rawData.preferred_workout_days || [],
        totalWorkoutsCompleted: rawData.total_workouts_completed,
        totalWorkoutMinutes: rawData.total_workout_minutes,
        activeDays: rawData.active_days,
        currentStreakDays: rawData.current_streak_days,
        longestStreakDays: rawData.longest_streak_days,
      };

      return transformedUser;
    } catch (error) {
      console.error('❌ getMemberProfile failed:', error);
      return null;
    }
  }

  // Get member's fitness assessments (for mentor dashboard)
  public async getMemberAssessments(userId: string): Promise<any[]> {
    try {
      const response = await apiClient.get('auth', `/api/users/${userId}/assessments`);
      console.log('📋 Raw getMemberAssessments response:', response.data);
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('❌ getMemberAssessments failed:', error);
      return [];
    }
  }
}

export const authService = new AuthService();