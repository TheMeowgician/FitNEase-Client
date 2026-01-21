import React, { useState, useEffect } from 'react';
import { View, Text, ViewStyle, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { DatePicker } from '../ui/DatePicker';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { calculateAge, formatDateToISO, parseISODate, getDateLimits } from '../../utils/dateUtils';
import { logServiceStatus } from '../../utils/serviceDebug';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

interface RegisterMentorFormProps {
  onSuccess: (requiresEmailVerification: boolean, userEmail?: string) => void;
  onLoginRedirect: () => void;
  style?: ViewStyle;
}

export const RegisterMentorForm: React.FC<RegisterMentorFormProps> = ({
  onSuccess,
  onLoginRedirect,
  style,
}) => {
  const { register } = useAuth();
  const alert = useAlert();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: undefined as 'male' | 'female' | 'other' | undefined,
    fitnessLevel: 'intermediate' as 'beginner' | 'intermediate' | 'advanced', // Mentors default to intermediate
    goals: [] as string[],
    bio: '', // Mentor-specific field
    specialties: [] as string[], // Mentor-specific field
    certifications: '', // Mentor-specific field
  });

  const [confirmPassword, setConfirmPassword] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(
    formData.dateOfBirth ? parseISODate(formData.dateOfBirth) : null
  );
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Calculate age when birthdate changes
  useEffect(() => {
    if (dateOfBirth) {
      const age = calculateAge(dateOfBirth);
      setCalculatedAge(age);
    } else {
      setCalculatedAge(null);
    }
  }, [dateOfBirth]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required field validation
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.username) newErrors.username = 'Username is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!contactNumber) newErrors.contactNumber = 'Contact number is required';
    if (!formData.password) newErrors.password = 'Password is required';
    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm password';
    if (!formData.gender) newErrors.gender = 'Please select your gender';

    // Mentor-specific validations
    if (!formData.bio || formData.bio.trim().length < 50) {
      newErrors.bio = 'Please provide a bio of at least 50 characters';
    }

    // Date of birth validation (required)
    if (!dateOfBirth) {
      newErrors.dateOfBirth = 'Birthdate is required';
    } else {
      const today = new Date();
      const selectedDate = new Date(dateOfBirth);

      // Remove time component for accurate date comparison
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);

      if (selectedDate >= today) {
        newErrors.dateOfBirth = 'Please select a date from the past';
      }

      // Age range validation: 18-54 years (RESEARCH REQUIREMENT)
      // This restriction minimizes the risk of exercise-related injuries
      // during high-intensity Tabata training workouts.
      const age = calculateAge(selectedDate);

      if (age < 18) {
        newErrors.dateOfBirth = 'You must be at least 18 years old to register. This app is designed for adults aged 18-54.';
      } else if (age > 54) {
        newErrors.dateOfBirth = 'Registration is limited to users aged 18-54 years for safety during high-intensity training.';
      } else if (age > 120) {
        // Sanity check for invalid birthdates
        newErrors.dateOfBirth = 'Please enter a valid birthdate';
      }
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (formData.password && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    // Confirm password validation
    if (formData.password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Contact number validation
    const phoneRegex = /^[0-9]{11}$/;
    if (contactNumber && !phoneRegex.test(contactNumber)) {
      newErrors.contactNumber = 'Contact number must be 11 digits';
    }

    // Terms agreement validation
    if (!agreedToTerms) newErrors.agreedToTerms = 'You must agree to the terms';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const capitalizeFirstLetter = (text: string) => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Prepare the registration data
      const registrationData = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        username: formData.username.trim(),
        firstName: capitalizeFirstLetter(formData.firstName?.trim() || ''),
        lastName: capitalizeFirstLetter(formData.lastName?.trim() || ''),
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender,
        phoneNumber: contactNumber.trim(),
        fitnessLevel: formData.fitnessLevel,
        goals: formData.goals || [],
        role: 'mentor' as const,
        bio: formData.bio,
        specialties: formData.specialties,
        certifications: formData.certifications,
      };

      console.log('Registering mentor with data:', registrationData);

      // Check service connectivity for debugging
      await logServiceStatus();

      const response = await register(registrationData);

      console.log('Mentor registration successful:', response);

      // Handle successful registration
      alert.success(
        'Mentor Registration Successful!',
        'Your application has been submitted and is pending approval. ' +
        (response.requiresEmailVerification
          ? 'Please check your email to verify your account.'
          : 'You will be notified once your mentor application is reviewed.'),
        () => onSuccess(response.requiresEmailVerification, formData.email)
      );

    } catch (error: any) {
      console.error('Mentor registration error:', error);

      // Handle specific error cases
      let errorMessage = 'An error occurred during registration. Please try again.';

      if (error.message) {
        if (error.message.includes('email')) {
          errorMessage = 'This email address is already registered. Please use a different email or try logging in.';
        } else if (error.message.includes('username')) {
          errorMessage = 'This username is already taken. Please choose a different username.';
        } else if (error.message.includes('password')) {
          errorMessage = 'Password does not meet requirements. Please ensure it\'s at least 8 characters long.';
        } else {
          errorMessage = error.message;
        }
      }

      alert.error('Registration Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: keyof typeof formData) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const updateContactNumber = (value: string) => {
    setContactNumber(value);
    if (errors.contactNumber) {
      setErrors(prev => ({ ...prev, contactNumber: '' }));
    }
  };

  const updateConfirmPassword = (value: string) => {
    setConfirmPassword(value);
    if (errors.confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: '' }));
    }
  };

  const updateBirthdate = (date: Date | null) => {
    setDateOfBirth(date);
    if (date) {
      setFormData(prev => ({
        ...prev,
        dateOfBirth: formatDateToISO(date)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        dateOfBirth: ''
      }));
    }
    if (errors.dateOfBirth) {
      setErrors(prev => ({ ...prev, dateOfBirth: '' }));
    }
  };

  return (
    <View style={style}>
      {/* Title and Subtitle */}
      <View style={styles.headerSection}>
        <Text style={styles.title}>
          Become a <Text style={styles.titleAccent}>Mentor</Text>
        </Text>
        <Text style={styles.subtitle}>
          Share your expertise and help others achieve their fitness goals through Tabata training.
        </Text>
      </View>

      {/* Sign Up Section */}
      <View style={styles.signupSection}>
        <Text style={styles.sectionTitle}>Mentor Application</Text>
        <Text style={styles.sectionSubtitle}>
          Please provide your details to apply as a mentor.
        </Text>

        {/* Name Fields - Same Line */}
        <View style={styles.nameRow}>
          <Input
            label="First name"
            placeholder="First name"
            value={formData.firstName || ''}
            onChangeText={updateField('firstName')}
            error={errors.firstName}
            style={styles.halfInput}
            leftIcon={<Ionicons name="person-outline" size={20} color={COLORS.SECONDARY[400]} />}
          />
          <Input
            label="Last name"
            placeholder="Last name"
            value={formData.lastName || ''}
            onChangeText={updateField('lastName')}
            error={errors.lastName}
            style={styles.halfInput}
            leftIcon={<Ionicons name="person-outline" size={20} color={COLORS.SECONDARY[400]} />}
          />
        </View>

        {/* Username */}
        <Input
          label="Username"
          placeholder="Username"
          value={formData.username}
          onChangeText={updateField('username')}
          error={errors.username}
          autoCapitalize="none"
          leftIcon={<Ionicons name="at-outline" size={20} color={COLORS.SECONDARY[400]} />}
          style={styles.inputMargin}
        />

        {/* Birthdate */}
        <DatePicker
          label="Birthdate"
          placeholder="DD/MM/YYYY"
          value={dateOfBirth}
          onDateChange={updateBirthdate}
          error={errors.dateOfBirth}
          {...getDateLimits()}
          style={styles.inputMargin}
        />

        {/* Age - Under Birthdate */}
        <Input
          label="Age"
          placeholder="Age"
          value={calculatedAge?.toString() || ''}
          onChangeText={() => {}} // Read-only
          editable={false}
          leftIcon={<Ionicons name="calendar-outline" size={20} color={COLORS.SECONDARY[400]} />}
          style={styles.inputMargin}
        />

        {/* Gender Selection */}
        <View style={styles.genderSection}>
          <Text style={styles.genderLabel}>Gender *</Text>
          <View style={styles.genderButtons}>
            <TouchableOpacity
              style={[
                styles.genderButton,
                formData.gender === 'male' && styles.genderButtonSelected
              ]}
              onPress={() => {
                setFormData(prev => ({ ...prev, gender: 'male' }));
                if (errors.gender) setErrors(prev => ({ ...prev, gender: '' }));
              }}
            >
              <Ionicons
                name="male"
                size={20}
                color={formData.gender === 'male' ? COLORS.PRIMARY[500] : COLORS.SECONDARY[400]}
              />
              <Text style={[
                styles.genderButtonText,
                formData.gender === 'male' && styles.genderButtonTextSelected
              ]}>
                Male
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.genderButton,
                formData.gender === 'female' && styles.genderButtonSelected
              ]}
              onPress={() => {
                setFormData(prev => ({ ...prev, gender: 'female' }));
                if (errors.gender) setErrors(prev => ({ ...prev, gender: '' }));
              }}
            >
              <Ionicons
                name="female"
                size={20}
                color={formData.gender === 'female' ? COLORS.PRIMARY[500] : COLORS.SECONDARY[400]}
              />
              <Text style={[
                styles.genderButtonText,
                formData.gender === 'female' && styles.genderButtonTextSelected
              ]}>
                Female
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.genderButton,
                formData.gender === 'other' && styles.genderButtonSelected
              ]}
              onPress={() => {
                setFormData(prev => ({ ...prev, gender: 'other' }));
                if (errors.gender) setErrors(prev => ({ ...prev, gender: '' }));
              }}
            >
              <Ionicons
                name="transgender"
                size={20}
                color={formData.gender === 'other' ? COLORS.PRIMARY[500] : COLORS.SECONDARY[400]}
              />
              <Text style={[
                styles.genderButtonText,
                formData.gender === 'other' && styles.genderButtonTextSelected
              ]}>
                Other
              </Text>
            </TouchableOpacity>
          </View>
          {errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}
        </View>

        {/* Mentor Bio */}
        <Text style={styles.contactSectionTitle}>About You</Text>
        <Input
          label="Bio"
          placeholder="Tell us about your fitness journey and why you want to be a mentor (minimum 50 characters)"
          value={formData.bio}
          onChangeText={updateField('bio')}
          error={errors.bio}
          multiline
          numberOfLines={4}
          style={styles.inputMargin}
        />
        <Text style={styles.hintText}>
          {formData.bio.length}/50 characters minimum
        </Text>

        {/* Certifications (Optional) */}
        <Input
          label="Certifications (Optional)"
          placeholder="List any fitness certifications you have"
          value={formData.certifications}
          onChangeText={updateField('certifications')}
          multiline
          numberOfLines={2}
          style={styles.inputMargin}
        />

        {/* Contact Information Section */}
        <Text style={styles.contactSectionTitle}>Contact Information</Text>

        {/* Email */}
        <Input
          label="Email Address"
          placeholder="Your personal email address"
          value={formData.email}
          onChangeText={updateField('email')}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          leftIcon={<Ionicons name="mail-outline" size={20} color={COLORS.SECONDARY[400]} />}
          style={styles.inputMargin}
        />

        {/* Contact Number */}
        <Input
          label="Contact number"
          placeholder="Your contact number"
          value={contactNumber}
          onChangeText={updateContactNumber}
          error={errors.contactNumber}
          keyboardType="phone-pad"
          leftIcon={<Ionicons name="call-outline" size={20} color={COLORS.SECONDARY[400]} />}
          style={styles.inputMargin}
        />
        {contactNumber === '' && (
          <Text style={styles.hintText}>Your contact number must be 11 numbers.</Text>
        )}

        {/* Security Section */}
        <Text style={styles.contactSectionTitle}>Security</Text>

        {/* Password */}
        <Input
          label="Password"
          placeholder="Password"
          value={formData.password}
          onChangeText={updateField('password')}
          error={errors.password}
          secureTextEntry={!showPassword}
          rightIcon={
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={COLORS.SECONDARY[400]}
              />
            </TouchableOpacity>
          }
          style={styles.inputMargin}
        />
        <Text style={styles.hintText}>The password must be at least 8 characters.</Text>

        {/* Confirm Password */}
        <Input
          label="Confirm Password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={updateConfirmPassword}
          error={errors.confirmPassword}
          secureTextEntry={!showConfirmPassword}
          rightIcon={
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={COLORS.SECONDARY[400]}
              />
            </TouchableOpacity>
          }
          style={styles.inputMargin}
        />
        <Text style={styles.hintText}>Repeat your password again correctly.</Text>

        {/* Terms and Privacy */}
        <View style={styles.termsContainer}>
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
          >
            <View style={styles.checkboxContainer}>
              <Ionicons
                name={agreedToTerms ? "checkbox" : "square-outline"}
                size={20}
                color={agreedToTerms ? "#0091FF" : COLORS.SECONDARY[400]}
              />
            </View>
            <Text style={styles.termsText}>
              I confirm that I have read, understood and agree to Privacy Policy and Mentor Guidelines.{'\n'}
              You agree to our Terms of Service and that you have read our Data Policy and Privacy Policy, including our Cookie Use. As a mentor, you also agree to uphold our community standards and provide quality guidance to members.
            </Text>
          </TouchableOpacity>
          {errors.agreedToTerms && (
            <Text style={styles.errorText}>{errors.agreedToTerms}</Text>
          )}
        </View>

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <Button
            title={isLoading ? "Submitting Application..." : "Submit Application"}
            onPress={handleRegister}
            loading={isLoading}
            style={styles.submitButton}
            size="large"
          />
        </View>
      </View>
    </View>
  );
};

const styles = {
  headerSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
  },
  titleAccent: {
    color: '#0091FF',
  },
  subtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    lineHeight: 20,
  },
  signupSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.SEMIBOLD,
    color: '#0091FF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginBottom: 24,
  },
  nameRow: {
    flexDirection: 'row' as const,
    gap: 12,
    marginBottom: 16,
  },
  halfInput: {
    flex: 1,
  },
  inputMargin: {
    marginBottom: 16,
  },
  contactSectionTitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
    marginTop: 16,
    marginBottom: 16,
  },
  hintText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: -12,
    marginBottom: 16,
  },
  termsContainer: {
    marginTop: 24,
    marginBottom: 24,
  },
  termsRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 4,
  },
  termsText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    lineHeight: 20,
    flex: 1,
  },
  errorText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.ERROR[500],
    marginTop: 8,
  },
  submitContainer: {
    marginTop: 24,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#0091FF',
    shadowColor: '#0091FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  genderSection: {
    marginBottom: 16,
  },
  genderLabel: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
    marginBottom: 12,
  },
  genderButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL[200],
    backgroundColor: COLORS.NEUTRAL.WHITE,
    gap: 8,
  },
  genderButtonSelected: {
    borderColor: COLORS.PRIMARY[500],
    backgroundColor: COLORS.PRIMARY[50],
  },
  genderButtonText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  genderButtonTextSelected: {
    color: COLORS.PRIMARY[500],
    fontFamily: FONTS.SEMIBOLD,
  },
};
