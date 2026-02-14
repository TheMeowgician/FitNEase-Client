import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { contentService, ExerciseListItem } from '../../services/microservices/contentService';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { hasExerciseDemo } from '../../constants/exerciseDemos';
import ExerciseDemoModal from '../../components/workout/ExerciseDemoModal';

const PER_PAGE = 30;

export default function ExerciseLibraryScreen() {
  const [exercises, setExercises] = useState<ExerciseListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    beginner: 0,
    intermediate: 0,
    advanced: 0,
    core: 0,
    upper_body: 0,
    lower_body: 0,
    full_body: 0,
  });

  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoExercise, setDemoExercise] = useState<{ name: string; muscleGroup: string } | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Load exercises with current filters
  const loadExercises = useCallback(async (page: number, append: boolean = false) => {
    try {
      if (page === 1 && !append) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const response = await contentService.getExerciseLibrary({
        page,
        per_page: PER_PAGE,
        search: searchQuery.trim() || undefined,
        difficulty: selectedDifficulty || undefined,
        muscle_group: selectedMuscleGroup || undefined,
      });

      if (append && page > 1) {
        setExercises(prev => [...prev, ...response.data]);
      } else {
        setExercises(response.data);
      }

      setCurrentPage(response.pagination.current_page);
      setLastPage(response.pagination.last_page);
      setTotalResults(response.pagination.total);
      setStats(response.stats);
    } catch (error) {
      console.error('Failed to load exercises:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [searchQuery, selectedDifficulty, selectedMuscleGroup]);

  // Initial load
  useEffect(() => {
    loadExercises(1);
  }, []);

  // Reload when filters change (not search - that's debounced)
  useEffect(() => {
    loadExercises(1);
  }, [selectedDifficulty, selectedMuscleGroup]);

  // Debounced search
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      // Trigger reload on page 1 with new search
      setCurrentPage(1);
      loadExercisesWithSearch(text);
    }, 300);
  };

  const loadExercisesWithSearch = async (search: string) => {
    try {
      setIsLoading(true);
      const response = await contentService.getExerciseLibrary({
        page: 1,
        per_page: PER_PAGE,
        search: search.trim() || undefined,
        difficulty: selectedDifficulty || undefined,
        muscle_group: selectedMuscleGroup || undefined,
      });

      setExercises(response.data);
      setCurrentPage(response.pagination.current_page);
      setLastPage(response.pagination.last_page);
      setTotalResults(response.pagination.total);
      setStats(response.stats);
    } catch (error) {
      console.error('Failed to search exercises:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadExercises(1);
    setRefreshing(false);
  };

  const loadMore = () => {
    if (!isLoadingMore && currentPage < lastPage) {
      loadExercises(currentPage + 1, true);
    }
  };

  const getDifficultyLabel = (level: number | string) => {
    const levelStr = String(level || '1');
    switch (levelStr) {
      case '1': return 'Beginner';
      case '2': return 'Intermediate';
      case '3': return 'Advanced';
      default: return 'Beginner';
    }
  };

  const getDifficultyColor = (level: number | string) => {
    const levelStr = String(level || '1');
    switch (levelStr) {
      case '1': return COLORS.SUCCESS[500];
      case '2': return COLORS.WARNING[500];
      case '3': return COLORS.ERROR[500];
      default: return COLORS.SECONDARY[500];
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

  const getStatCount = (_type: string, value: string | null): number => {
    if (value === null) return stats.total;
    return (stats as any)[value] ?? 0;
  };

  const getDifficultyStatCount = (value: string | null): number => {
    if (value === null) return stats.total;
    switch (value) {
      case '1': return stats.beginner;
      case '2': return stats.intermediate;
      case '3': return stats.advanced;
      default: return 0;
    }
  };

  const handleDemoPress = (exerciseName: string, muscleGroup: string) => {
    setDemoExercise({ name: exerciseName, muscleGroup });
    setShowDemoModal(true);
  };

  const renderExerciseCard = ({ item: exercise }: { item: ExerciseListItem }) => {
    const hasDemoGif = hasExerciseDemo(exercise.exercise_name, exercise.target_muscle_group);

    return (
      <View style={styles.exerciseCard}>
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
          {hasDemoGif && (
            <TouchableOpacity
              style={styles.demoButton}
              onPress={() => handleDemoPress(exercise.exercise_name, exercise.target_muscle_group)}
              activeOpacity={0.7}
            >
              <Ionicons name="play-circle" size={16} color={COLORS.PRIMARY[500]} />
              <Text style={styles.demoButtonText}>Demo</Text>
            </TouchableOpacity>
          )}
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
      </View>
    );
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.PRIMARY[600]} />
        <Text style={styles.footerText}>Loading more exercises...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={64} color={COLORS.SECONDARY[300]} />
        <Text style={styles.emptyTitle}>No Exercises Found</Text>
        <Text style={styles.emptyText}>
          Try adjusting your filters or search query
        </Text>
      </View>
    );
  };

  const renderHeader = () => (
    <>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.SECONDARY[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            placeholderTextColor={COLORS.SECONDARY[400]}
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); loadExercisesWithSearch(''); }}>
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
          {difficultyLevels.map((level) => (
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
                {level.label} ({getDifficultyStatCount(level.value)})
              </Text>
            </TouchableOpacity>
          ))}
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
          {muscleGroups.map((group) => (
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
                {group.label} ({getStatCount('muscle', group.value)})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results Count */}
      <View style={styles.resultsSection}>
        <Text style={styles.resultsText}>
          {totalResults} {totalResults === 1 ? 'exercise' : 'exercises'} found
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
    </>
  );

  if (isLoading && exercises.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
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

      <FlatList
        ref={flatListRef}
        data={exercises}
        renderItem={renderExerciseCard}
        keyExtractor={(item) => String(item.exercise_id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      {/* Exercise Demo Modal */}
      <ExerciseDemoModal
        visible={showDemoModal}
        exerciseName={demoExercise?.name || ''}
        targetMuscleGroup={demoExercise?.muscleGroup}
        onClose={() => setShowDemoModal(false)}
      />
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
  listContent: {
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
  exerciseCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 12,
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
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY[50],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[100],
  },
  demoButtonText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[500],
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
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  footerText: {
    fontSize: FONT_SIZES.SM,
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
