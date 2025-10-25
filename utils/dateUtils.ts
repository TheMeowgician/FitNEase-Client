/**
 * Calculate age from date of birth
 * @param dateOfBirth - Date object representing the birth date
 * @returns number - Age in years
 */
export const calculateAge = (dateOfBirth: Date | string): number => {
  const today = new Date();

  // Handle both Date objects and ISO date strings
  let birthDate: Date;
  if (typeof dateOfBirth === 'string') {
    // Check if it's a datetime string (contains 'T') or simple date string (YYYY-MM-DD)
    if (dateOfBirth.includes('T')) {
      // ISO datetime string (e.g., "2000-11-18T00:00:00.000000Z")
      birthDate = new Date(dateOfBirth);
      console.log('📅 [calculateAge] Parsed datetime string:', birthDate);
    } else {
      // Simple date string (YYYY-MM-DD)
      const [year, month, day] = dateOfBirth.split('-').map(Number);
      birthDate = new Date(year, month - 1, day); // month is 0-indexed
      console.log('📅 [calculateAge] Parsed date string:', { year, month, day, birthDate });
    }
  } else {
    birthDate = new Date(dateOfBirth);
    console.log('📅 [calculateAge] Using Date object:', birthDate);
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  console.log('📅 [calculateAge] Calculation:', {
    today: today.toISOString(),
    birthDate: birthDate.toISOString(),
    yearDiff: age,
    monthDiff,
    todayDay: today.getDate(),
    birthDay: birthDate.getDate()
  });

  // If birth month hasn't occurred this year, or it's the birth month but the day hasn't occurred yet
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
    console.log('📅 [calculateAge] Subtracting 1 year because birthday hasn\'t occurred yet');
  }

  console.log('📅 [calculateAge] Final age:', age);
  return age;
};

/**
 * Format date to ISO string (YYYY-MM-DD)
 * @param date - Date object
 * @returns string - Date in YYYY-MM-DD format
 */
export const formatDateToISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * Parse ISO date string to Date object
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date - Date object or null if invalid
 */
export const parseISODate = (dateString: string): Date | null => {
  if (!dateString) return null;

  const date = new Date(dateString);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
};

/**
 * Validate age range for registration
 * @param age - Age in years
 * @returns object - Validation result with isValid boolean and error message
 *
 * RESEARCH REQUIREMENT: Age must be between 18-54 years
 * This restriction is implemented to minimize the risk of exercise-related
 * injuries during high-intensity Tabata training workouts.
 */
export const validateAge = (age: number): { isValid: boolean; error?: string } => {
  // Minimum age validation (18 years)
  if (age < 18) {
    return {
      isValid: false,
      error: 'You must be at least 18 years old to register. This app is designed for adults aged 18-54.',
    };
  }

  // Maximum age validation (54 years)
  if (age > 54) {
    return {
      isValid: false,
      error: 'Registration is limited to users aged 18-54 years for safety during high-intensity training.',
    };
  }

  // Upper bound sanity check (prevent invalid birthdates)
  if (age > 120) {
    return {
      isValid: false,
      error: 'Please enter a valid date of birth',
    };
  }

  return { isValid: true };
};

/**
 * Get minimum and maximum dates for date picker
 * @returns object - Min and max dates for registration
 *
 * RESEARCH REQUIREMENT: Age must be between 18-54 years
 * - minDate: 54 years ago (maximum age allowed)
 * - maxDate: 18 years ago (minimum age allowed)
 */
export const getDateLimits = () => {
  const today = new Date();

  // Minimum date: 54 years ago (maximum age allowed: 54)
  const minDate = new Date();
  minDate.setFullYear(today.getFullYear() - 54);

  // Maximum date: 18 years ago (minimum age allowed: 18)
  const maxDate = new Date();
  maxDate.setFullYear(today.getFullYear() - 18);

  return {
    minDate,
    maxDate,
  };
};