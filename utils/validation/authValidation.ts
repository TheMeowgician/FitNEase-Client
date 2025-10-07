import { APP_CONFIG } from '../../constants/app-config';

export const validateEmail = (email: string): boolean => {
  return APP_CONFIG.VALIDATION.EMAIL_REGEX.test(email);
};

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < APP_CONFIG.VALIDATION.PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${APP_CONFIG.VALIDATION.PASSWORD_MIN_LENGTH} characters long`);
  }

  if (!/(?=.*[a-z])/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/(?=.*[A-Z])/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/(?=.*\d)/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateUsername = (username: string): { isValid: boolean; error?: string } => {
  if (username.length < APP_CONFIG.VALIDATION.USERNAME_MIN_LENGTH) {
    return {
      isValid: false,
      error: `Username must be at least ${APP_CONFIG.VALIDATION.USERNAME_MIN_LENGTH} characters long`,
    };
  }

  if (username.length > APP_CONFIG.VALIDATION.USERNAME_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Username must be less than ${APP_CONFIG.VALIDATION.USERNAME_MAX_LENGTH} characters long`,
    };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      isValid: false,
      error: 'Username can only contain letters, numbers, and underscores',
    };
  }

  return { isValid: true };
};

export const validateVerificationCode = (code: string): boolean => {
  return code.length === APP_CONFIG.VALIDATION.VERIFICATION_CODE_LENGTH && /^\d+$/.test(code);
};