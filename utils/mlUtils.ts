/**
 * ML Algorithm Utility Functions
 * Helpers for displaying ML algorithm information in the UI
 */

/**
 * Convert backend recommendation_type to display string
 * @param recommendationType - The recommendation type from backend (e.g., "hybrid", "content_based", "collaborative")
 * @returns Display-friendly algorithm name (e.g., "Hybrid", "Content Based", "Collaborative")
 */
export const getAlgorithmDisplayName = (recommendationType?: string): string => {
  if (!recommendationType) {
    return 'ML';
  }

  switch (recommendationType.toLowerCase()) {
    case 'hybrid':
      return 'Hybrid';
    case 'content_based':
    case 'content-based':
      return 'Content Based';
    case 'collaborative':
      return 'Collaborative';
    case 'random_forest':
    case 'random-forest':
      return 'Random Forest';
    default:
      return 'ML';
  }
};

/**
 * Get the predominant algorithm from a list of exercises
 * Useful for showing which algorithm was primarily used for a workout set
 * @param exercises - Array of exercises with recommendation_type field
 * @returns Display name of the most common algorithm
 */
export const getPredominantAlgorithm = (exercises: any[]): string => {
  if (!exercises || exercises.length === 0) {
    return 'ML';
  }

  // Count occurrences of each algorithm
  const algorithmCounts: { [key: string]: number } = {};

  exercises.forEach(exercise => {
    const type = exercise.recommendation_type || 'unknown';
    algorithmCounts[type] = (algorithmCounts[type] || 0) + 1;
  });

  // Find the most common algorithm
  let maxCount = 0;
  let predominantAlgorithm = 'unknown';

  Object.entries(algorithmCounts).forEach(([algorithm, count]) => {
    if (count > maxCount) {
      maxCount = count;
      predominantAlgorithm = algorithm;
    }
  });

  return getAlgorithmDisplayName(predominantAlgorithm);
};

/**
 * Get algorithm color for UI display
 * @param recommendationType - The recommendation type from backend
 * @returns Color hex code for the algorithm
 */
export const getAlgorithmColor = (recommendationType?: string): string => {
  if (!recommendationType) {
    return '#6B7280'; // Gray
  }

  switch (recommendationType.toLowerCase()) {
    case 'hybrid':
      return '#10B981'; // Green - Most advanced
    case 'content_based':
    case 'content-based':
      return '#3B82F6'; // Blue - Content analysis
    case 'collaborative':
      return '#8B5CF6'; // Purple - Social analysis
    case 'random_forest':
    case 'random-forest':
      return '#F59E0B'; // Orange - ML classifier
    default:
      return '#6B7280'; // Gray - Unknown
  }
};

/**
 * Get algorithm icon name for Ionicons
 * @param recommendationType - The recommendation type from backend
 * @returns Ionicons icon name
 */
export const getAlgorithmIcon = (recommendationType?: string): string => {
  if (!recommendationType) {
    return 'flash';
  }

  switch (recommendationType.toLowerCase()) {
    case 'hybrid':
      return 'analytics';
    case 'content_based':
    case 'content-based':
      return 'fitness';
    case 'collaborative':
      return 'people';
    case 'random_forest':
    case 'random-forest':
      return 'leaf';
    default:
      return 'flash';
  }
};
