/**
 * Capitalizes the first letter of a string
 * @param str - The string to capitalize
 * @returns The string with the first letter capitalized
 */
export const capitalizeFirstLetter = (str: string | undefined | null): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Capitalizes the first letter of each word in a string
 * @param str - The string to capitalize
 * @returns The string with each word capitalized
 */
export const capitalizeWords = (str: string | undefined | null): string => {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => capitalizeFirstLetter(word))
    .join(' ');
};

/**
 * Formats a full name (first + last) with proper capitalization
 * @param firstName - First name
 * @param lastName - Last name (optional)
 * @returns Formatted full name
 */
export const formatFullName = (firstName: string | undefined | null, lastName?: string | undefined | null): string => {
  const first = capitalizeFirstLetter(firstName);
  const last = capitalizeFirstLetter(lastName);

  if (first && last) {
    return `${first} ${last}`;
  }
  return first || last || '';
};
