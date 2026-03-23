import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, FONTS } from '../../constants/colors';
import { useSmartBack } from '../../hooks/useSmartBack';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { socialService, Group } from '../../services/microservices/socialService';
import { mediaService } from '../../services/microservices/mediaService';

const PER_PAGE = 15;

export default function DiscoverGroupsScreen() {
  const { goBack } = useSmartBack();
  const { user } = useAuth();
  const alert = useAlert();

  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());
  const [pendingRequestGroupIds, setPendingRequestGroupIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalGroups, setTotalGroups] = useState(0);
  const [loadingGroupId, setLoadingGroupId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [truncatedDescriptions, setTruncatedDescriptions] = useState<Set<string>>(new Set());

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchVersionRef = useRef(0); // Tracks search version to discard stale responses
  const loadingMoreRef = useRef(false); // Guard against concurrent loadMore calls

  useEffect(() => {
    loadInitialData();
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(false);
    setHasMore(true);
    try {
      const [myGroupsData, userJoinRequests] = await Promise.all([
        socialService.getGroups({ user_id: parseInt(user?.id || '0'), per_page: 100 }),
        socialService.getUserJoinRequests().catch(() => ({ data: [] })),
      ]);

      const myIds = new Set(myGroupsData.groups.map((g: Group) => g.id));
      setMyGroupIds(myIds);

      const pendingIds = new Set(
        (userJoinRequests.data || [])
          .filter((req: any) => req.status === 'pending')
          .map((req: any) => String(req.group_id))
      );
      setPendingRequestGroupIds(pendingIds);

      await loadGroups(1, '', myIds);
    } catch (err) {
      console.error('[DISCOVER] Failed to load initial data:', err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async (
    page: number,
    search: string,
    excludeIds?: Set<string>,
    version?: number
  ) => {
    const idsToExclude = excludeIds || myGroupIds;

    try {
      const params: any = { per_page: PER_PAGE, page };
      if (search.trim()) {
        params.search = search.trim();
      }

      const result = await socialService.getGroups(params);

      // Discard stale search responses
      if (version !== undefined && version !== searchVersionRef.current) {
        return;
      }

      // Fetch actual member counts
      const groupsWithCounts = await Promise.all(
        result.groups.map(async (group: Group) => {
          try {
            const membersData = await socialService.getGroupMembers(group.id, 1, 1);
            return { ...group, memberCount: membersData.total || group.memberCount };
          } catch {
            return group;
          }
        })
      );

      // Filter out user's own groups
      const filtered = groupsWithCounts.filter((g: Group) => !idsToExclude.has(g.id));

      if (page === 1) {
        setGroups(filtered);
      } else {
        setGroups((prev) => [...prev, ...filtered]);
      }

      setCurrentPage(page);
      setTotalGroups(result.total);
      // No more pages when backend returned fewer results than requested
      setHasMore(result.groups.length >= PER_PAGE);
      setError(false);
    } catch (err) {
      console.error('[DISCOVER] Failed to load groups:', err);
      if (page === 1) {
        setGroups([]);
        setError(true);
      }
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    // Increment version to invalidate any in-flight requests
    searchVersionRef.current += 1;
    const thisVersion = searchVersionRef.current;

    setIsSearching(true);

    searchTimerRef.current = setTimeout(async () => {
      await loadGroups(1, text, undefined, thisVersion);
      // Only clear searching if this is still the latest version
      if (thisVersion === searchVersionRef.current) {
        setIsSearching(false);
      }
    }, 400);
  };

  const handleLoadMore = async () => {
    if (loadingMoreRef.current || !hasMore || isSearching) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    await loadGroups(currentPage + 1, searchQuery);
    setIsLoadingMore(false);
    loadingMoreRef.current = false;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setSearchQuery('');
    searchVersionRef.current += 1;
    await loadInitialData();
    setRefreshing(false);
  };

  const handleJoinGroup = async (group: Group) => {
    if (loadingGroupId) return;
    setLoadingGroupId(group.id);
    try {
      await socialService.createJoinRequest(group.id);
      alert.success(
        'Request Sent!',
        `Your request to join "${group.name}" has been sent to the group owner for approval.`
      );
      setPendingRequestGroupIds((prev) => new Set(prev).add(group.id));
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('already') && msg.toLowerCase().includes('pending')) {
        alert.info(
          'Request Pending',
          `You already have a pending request to join "${group.name}".`
        );
        setPendingRequestGroupIds((prev) => new Set(prev).add(group.id));
      } else {
        alert.error('Error', msg || 'Failed to send join request.');
      }
    } finally {
      setLoadingGroupId(null);
    }
  };

  const handleCancelJoinRequest = (group: Group) => {
    if (loadingGroupId) return;
    alert.confirm(
      'Cancel Request',
      `Cancel your request to join "${group.name}"?`,
      async () => {
        setLoadingGroupId(group.id);
        try {
          await socialService.cancelJoinRequest(group.id);
          setPendingRequestGroupIds((prev) => {
            const next = new Set(prev);
            next.delete(group.id);
            return next;
          });
          alert.success('Cancelled', 'Your join request has been cancelled.');
        } catch (err: any) {
          alert.error('Error', err.message || 'Failed to cancel join request.');
        } finally {
          setLoadingGroupId(null);
        }
      },
      undefined,
      'Cancel Request',
      'Keep Request'
    );
  };

  const renderGroupCard = useCallback(
    ({ item: group }: { item: Group }) => (
      <View style={styles.groupCard}>
        <TouchableOpacity
          style={styles.groupCardHeader}
          onPress={() => router.push(`/groups/${group.id}`)}
          activeOpacity={0.7}
        >
          <View style={[styles.groupAvatar, { overflow: 'hidden' }]}>
            {group.groupImage ? (
              <Image
                source={{ uri: mediaService.getFullMediaUrl(group.groupImage) }}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <Ionicons name="globe" size={28} color="white" />
            )}
          </View>
          <View style={styles.groupInfo}>
            <Text style={styles.groupName} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={styles.groupMembers}>
              {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
              {group.maxMembers ? ` / ${group.maxMembers} max` : ''}
            </Text>
          </View>
        </TouchableOpacity>

        {group.description ? (
          <View style={styles.descriptionContainer}>
            <Text
              style={styles.groupDescription}
              numberOfLines={expandedDescriptions.has(group.id) ? undefined : 2}
              onTextLayout={(e) => {
                if (e.nativeEvent.lines.length > 2 && !truncatedDescriptions.has(group.id)) {
                  setTruncatedDescriptions((prev) => new Set(prev).add(group.id));
                }
              }}
            >
              {group.description}
            </Text>
            {truncatedDescriptions.has(group.id) && (
              <TouchableOpacity
                onPress={() => {
                  setExpandedDescriptions((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.id)) {
                      next.delete(group.id);
                    } else {
                      next.add(group.id);
                    }
                    return next;
                  });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.readMoreText}>
                  {expandedDescriptions.has(group.id) ? 'Show less' : 'Read more'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        <View style={styles.groupFooter}>
          <View style={styles.groupTag}>
            <Ionicons
              name={group.type === 'private' ? 'lock-closed' : 'globe'}
              size={14}
              color={COLORS.PRIMARY[600]}
            />
            <Text style={styles.groupTagText}>{group.type}</Text>
          </View>

          {pendingRequestGroupIds.has(group.id) ? (
            <TouchableOpacity
              style={[styles.pendingBadge, loadingGroupId === group.id && { opacity: 0.5 }]}
              onPress={() => handleCancelJoinRequest(group)}
              activeOpacity={0.7}
              disabled={loadingGroupId !== null}
            >
              {loadingGroupId === group.id ? (
                <ActivityIndicator size={14} color={COLORS.WARNING[700]} />
              ) : (
                <Ionicons name="close-circle" size={14} color={COLORS.WARNING[700]} />
              )}
              <Text style={styles.pendingBadgeText}>Cancel Request</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.joinButton, loadingGroupId === group.id && { opacity: 0.5 }]}
              onPress={() => handleJoinGroup(group)}
              activeOpacity={0.7}
              disabled={loadingGroupId !== null}
            >
              {loadingGroupId === group.id ? (
                <ActivityIndicator size={12} color="#fff" />
              ) : (
                <Text style={styles.joinButtonText}>Request to Join</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    ),
    [pendingRequestGroupIds, loadingGroupId, expandedDescriptions, truncatedDescriptions]
  );

  const renderFooter = () => {
    if (!hasMore) return null;
    if (isLoadingMore) {
      return (
        <View style={styles.loadMoreContainer}>
          <ActivityIndicator size="small" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadMoreText}>Loading more groups...</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore} activeOpacity={0.7}>
        <Text style={styles.loadMoreButtonText}>Load More</Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.PRIMARY[600]} />
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (isLoading || isSearching) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name={searchQuery ? 'search-outline' : 'people-outline'}
          size={64}
          color={COLORS.SECONDARY[300]}
        />
        <Text style={styles.emptyStateTitle}>
          {searchQuery ? 'No Results' : 'No Groups Found'}
        </Text>
        <Text style={styles.emptyStateText}>
          {searchQuery
            ? `No groups match "${searchQuery}". Try a different search.`
            : 'There are no public groups to discover right now. Check back later!'}
        </Text>
        {searchQuery ? (
          <TouchableOpacity
            style={styles.clearSearchButton}
            onPress={() => {
              setSearchQuery('');
              searchVersionRef.current += 1;
              const v = searchVersionRef.current;
              setIsSearching(true);
              loadGroups(1, '', undefined, v).then(() => {
                if (v === searchVersionRef.current) setIsSearching(false);
              });
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.clearSearchButtonText}>Clear Search</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Discover Groups</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && groups.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Discover Groups</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color={COLORS.SECONDARY[300]} />
          <Text style={styles.emptyStateTitle}>Something went wrong</Text>
          <Text style={styles.emptyStateText}>
            Could not load groups. Please check your connection and try again.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadInitialData} activeOpacity={0.7}>
            <Ionicons name="refresh" size={18} color="white" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discover Groups</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.SECONDARY[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search groups..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholderTextColor={COLORS.SECONDARY[400]}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                searchVersionRef.current += 1;
                const v = searchVersionRef.current;
                setIsSearching(true);
                loadGroups(1, '', undefined, v).then(() => {
                  if (v === searchVersionRef.current) setIsSearching(false);
                });
              }}
            >
              <Ionicons name="close-circle" size={20} color={COLORS.SECONDARY[400]} />
            </TouchableOpacity>
          ) : null}
        </View>
        {isSearching && (
          <View style={styles.searchingIndicator}>
            <ActivityIndicator size="small" color={COLORS.PRIMARY[600]} />
            <Text style={styles.searchingText}>Searching...</Text>
          </View>
        )}
      </View>

      {/* Results count */}
      {!isSearching && groups.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {totalGroups} {totalGroups === 1 ? 'group' : 'groups'} found
          </Text>
        </View>
      )}

      {/* Group List */}
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: '#111827',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: COLORS.NEUTRAL[200],
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[900],
    padding: 0,
  },
  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    gap: 6,
  },
  searchingText: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  resultsCount: {
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.SECONDARY[500],
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY[600],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
    gap: 6,
  },
  retryButtonText: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
  },
  groupCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
  },
  groupMembers: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  descriptionContainer: {
    marginBottom: 12,
  },
  groupDescription: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    lineHeight: 20,
  },
  readMoreText: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
    marginTop: 4,
  },
  groupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  groupTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.NEUTRAL[100],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  groupTagText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[700],
    textTransform: 'capitalize',
  },
  joinButton: {
    backgroundColor: COLORS.PRIMARY[600],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  joinButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WARNING[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 'auto',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.WARNING[300],
  },
  pendingBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.WARNING[700],
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  clearSearchButton: {
    backgroundColor: COLORS.PRIMARY[100],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  clearSearchButtonText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  loadMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  loadMoreButtonText: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
});
