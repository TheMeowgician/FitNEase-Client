import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { contentService, Exercise } from '../../services/microservices/contentService';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

export default function ExerciseLibraryScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);
  const [stats, setStats] = useState({
    beginner: 0,
    intermediate: 0,
    advanced: 0,
    core: 0,
    upper_body: 0,
    lower_body: 0,
    total: 0,
  });

  useEffect(() => {
    loadExercises();
  }, []);

  useEffect(() => {
    filterExercises();
  }, [searchQuery, selectedDifficulty, selectedMuscleGroup, exercises]);

  const loadExercises = async () => {
    try {
      setIsLoading(true);
      // Fetch ALL exercises from the database
      const data = await contentService.getAllExercises();
      console.log('📚 [EXERCISE LIBRARY] Loaded exercises:', data.length);
      if (data.length > 0) {
        console.log('📚 [EXERCISE LIBRARY] Sample exercise data:', JSON.stringify(data[0], null, 2));
      }

      // Calculate stats
      const newStats = {
        beginner: data.filter(ex => String(ex.difficulty_level) === '1').length,
        intermediate: data.filter(ex => String(ex.difficulty_level) === '2').length,
        advanced: data.filter(ex => String(ex.difficulty_level) === '3').length,
        core: data.filter(ex => ex.target_muscle_group === 'core').length,
        upper_body: data.filter(ex => ex.target_muscle_group === 'upper_body').length,
        lower_body: data.filter(ex => ex.target_muscle_group === 'lower_body').length,
        total: data.length,
      };
      console.log('📊 [EXERCISE LIBRARY] Stats:', newStats);
      setStats(newStats);

      setExercises(data);
      setFilteredExercises(data);
    } catch (error) {
      console.error('Failed to load exercises:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadExercises();
    setRefreshing(false);
  };

  const filterExercises = () => {
    let filtered = [...exercises];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (ex) =>
          (ex.exercise_name || '').toLowerCase().includes(query) ||
          (ex.target_muscle_group || '').toLowerCase().includes(query) ||
          (ex.exercise_category || '').toLowerCase().includes(query)
      );
    }

    // Filter by difficulty (numeric values: 1=beginner, 2=medium, 3=expert)
    if (selectedDifficulty !== null) {
      filtered = filtered.filter((ex) => {
        const level = String(ex.difficulty_level || '');
        // Map numeric to string values for filtering
        if (selectedDifficulty === '1' && level === '1') return true;
        if (selectedDifficulty === '2' && level === '2') return true;
        if (selectedDifficulty === '3' && level === '3') return true;
        return false;
      });
    }

    // Filter by muscle group
    if (selectedMuscleGroup) {
      filtered = filtered.filter((ex) =>
        (ex.target_muscle_group || '').toLowerCase() === selectedMuscleGroup.toLowerCase()
      );
    }

    setFilteredExercises(filtered);
  };

  const getDifficultyLabel = (level: number | string) => {
    if (!level && level !== 0) return 'Beginner';
    const levelStr = String(level);
    switch (levelStr) {
      case '1':
        return 'Beginner';
      case '2':
        return 'Intermediate';
      case '3':
        return 'Advanced';
      default:
        return 'Beginner';
    }
  };

  const getDifficultyColor = (level: number | string) => {
    if (!level && level !== 0) return COLORS.SECONDARY[500];
    const levelStr = String(level);
    switch (levelStr) {
      case '1':
        return COLORS.SUCCESS[500];
      case '2':
        return COLORS.WARNING[500];
      case '3':
        return COLORS.ERROR[500];
      default:
        return COLORS.SECONDARY[500];
    }
  };

  const getMuscleGroupIcon = (muscleGroup: string): keyof typeof Ionicons.glyphMap => {
    if (!muscleGroup) return 'barbell';
    const lowerGroup = muscleGroup.toLowerCase();
    if (lowerGroup.includes('chest') || lowerGroup.includes('upper_body')) return 'body';
    if (lowerGroup.includes('leg') || lowerGroup.includes('lower_body')) return 'walk';
    if (lowerGroup.includes('core') || lowerGroup.includes('abs')) return 'fitness';
    if (lowerGroup.includes('back')) return 'body';
    if (lowerGroup.includes('shoulder')) return 'body';
    return 'barbell';
  };

  const muscleGroups = [
    { label: 'All', value: null },
    { label: 'Upper Body', value: 'upper_body' },
    { label: 'Lower Body', value: 'lower_body' },
    { label: 'Core', value: 'core' },
    { label: 'Full Body', value: 'full_body' },
  ];

  const difficultyLevels = [
    { label: 'All', value: null },
    { label: 'Beginner', value: '1' },
    { label: 'Intermediate', value: '2' },
    { label: 'Advanced', value: '3' },
  ];

  const formatMuscleGroup = (muscleGroup: string) => {
    if (!muscleGroup) return 'Unknown';
    return muscleGroup
      .split(',')
      .map((group) =>
        group
          .trim()
          .replace(/_/g, ' ')
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      )
      .join(', ');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadingText}>Loading exercises...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Fixed Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Exercise Library</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.SECONDARY[400]} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={COLORS.SECONDARY[400]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={COLORS.SECONDARY[400]} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Chips - Difficulty */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Difficulty</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipContainer}
          >
            {difficultyLevels.map((level) => {
              const count = level.value === null
                ? stats.total
                : level.value === '1'
                  ? stats.beginner
                  : level.value === '2'
                    ? stats.intermediate
                    : stats.advanced;

              return (
                <TouchableOpacity
                  key={level.label}
                  style={[
                    styles.chip,
                    selectedDifficulty === level.value && styles.chipSelected,
                  ]}
                  onPress={() => setSelectedDifficulty(level.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedDifficulty === level.value && styles.chipTextSelected,
                    ]}
                  >
                    {level.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Filter Chips - Muscle Group */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Muscle Group</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipContainer}
          >
            {muscleGroups.map((group) => {
              const count = group.value === null
                ? stats.total
                : group.value === 'upper_body'
                  ? stats.upper_body
                  : group.value === 'lower_body'
                    ? stats.lower_body
                    : group.value === 'core'
                      ? stats.core
                      : 0;

              return (
                <TouchableOpacity
                  key={group.label}
                  style={[
                    styles.chip,
                    selectedMuscleGroup === group.value && styles.chipSelected,
                  ]}
                  onPress={() => setSelectedMuscleGroup(group.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedMuscleGroup === group.value && styles.chipTextSelected,
                    ]}
                  >
                    {group.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Results Count */}
        <View style={styles.resultsSection}>
          <Text style={styles.resultsText}>
            {filteredExercises.length} {filteredExercises.length === 1 ? 'exercise' : 'exercises'} found
          </Text>
          {(searchQuery || selectedDifficulty !== null || selectedMuscleGroup) && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSelectedDifficulty(null);
                setSelectedMuscleGroup(null);
              }}
            >
              <Text style={styles.clearFiltersText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Exercise List */}
        {filteredExercises.length > 0 ? (
          <View style={styles.exerciseList}>
            {filteredExercises.map((exercise, index) => (
              <TouchableOpacity
                key={`${exercise.exercise_id}-${index}`}
                style={styles.exerciseCard}
                activeOpacity={0.7}
              >
                {/* Exercise Icon & Name */}
                <View style={styles.exerciseHeader}>
                  <View
                    style={[
                      styles.exerciseIcon,
                      { backgroundColor: getDifficultyColor(exercise.difficulty_level) + '15' },
                    ]}
                  >
                    <Ionicons
                      name={getMuscleGroupIcon(exercise.target_muscle_group)}
                      size={24}
                      color={getDifficultyColor(exercise.difficulty_level)}
                    />
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                    <Text style={styles.exerciseCategory}>
                      {formatMuscleGroup(exercise.target_muscle_group)}
                    </Text>
                  </View>
                </View>

                {/* Exercise Stats */}
                <View style={styles.exerciseStats}>
                  <View style={styles.statBadge}>
                    <Ionicons
                      name="speedometer"
                      size={14}
                      color={getDifficultyColor(exercise.difficulty_level)}
                    />
                    <Text
                      style={[
                        styles.statText,
                        { color: getDifficultyColor(exercise.difficulty_level) },
                      ]}
                    >
                      {getDifficultyLabel(exercise.difficulty_level)}
                    </Text>
                  </View>
                  <View style={styles.statBadge}>
                    <Ionicons name="time-outline" size={14} color={COLORS.SECONDARY[600]} />
                    <Text style={styles.statText}>
                      {exercise.default_duration_seconds
                        ? `${Math.round(exercise.default_duration_seconds / 60)} min`
                        : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.statBadge}>
                    <Ionicons name="flame-outline" size={14} color={COLORS.WARNING[500]} />
                    <Text style={styles.statText}>
                      {exercise.calories_burned_per_minute && exercise.default_duration_seconds
                        ? `${Math.round(exercise.calories_burned_per_minute * (exercise.default_duration_seconds / 60))} cal`
                        : 'N/A'}
                    </Text>
                  </View>
                </View>

                {/* Equipment */}
                {exercise.equipment_needed && exercise.equipment_needed !== 'none' && (
                  <View style={styles.equipmentBadge}>
                    <Ionicons name="construct-outline" size={12} color={COLORS.SECONDARY[600]} />
                    <Text style={styles.equipmentText}>{exercise.equipment_needed}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color={COLORS.SECONDARY[300]} />
            <Text style={styles.emptyTitle}>No Exercises Found</Text>
            <Text style={styles.emptyText}>
              Try adjusting your filters or search query
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  searchSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: '#111827',
    marginLeft: 12,
  },
  filterSection: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: COLORS.PRIMARY[600],
    borderColor: COLORS.PRIMARY[600],
  },
  chipText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  chipTextSelected: {
    color: 'white',
  },
  resultsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  resultsText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
  },
  clearFiltersText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  exerciseList: {
    paddingHorizontal: 24,
    gap: 12,
  },
  exerciseCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: '#111827',
    marginBottom: 4,
  },
  exerciseCategory: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  exerciseStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  equipmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  equipmentText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[700],
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
  },
});
