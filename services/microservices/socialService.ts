import { apiClient, ApiResponse } from '../api/client';

export interface Group {
  id: string;
  name: string;
  description: string;
  type: 'public' | 'private' | 'invite-only';
  category: 'fitness' | 'running' | 'weightlifting' | 'yoga' | 'cycling' | 'other';
  memberCount: number;
  maxMembers?: number;
  isActive: boolean;
  createdBy: string;
  moderators: string[];
  tags: string[];
  rules?: string[];
  groupImage?: string;
  groupCode?: string; // 8-character invite code
  location?: {
    type: 'online' | 'in-person' | 'hybrid';
    city?: string;
    region?: string;
    venue?: string;
  };
  schedule?: {
    recurring: boolean;
    days?: string[];
    time?: string;
    timezone?: string;
  };
  achievements: GroupAchievement[];
  stats: GroupStats;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  id: string;
  userId: string;
  username: string;
  profilePicture?: string;
  role: 'owner' | 'moderator' | 'member';
  userRole?: 'mentor' | 'member'; // User's app role (for mentor badge)
  joinedAt: string;
  lastActive: string;
  contributions: {
    workoutsShared: number;
    challengesCreated: number;
    helpfulPosts: number;
  };
  status: 'active' | 'inactive' | 'banned';
}

export interface GroupAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string;
  criteria: string;
}

export interface GroupStats {
  totalWorkouts: number;
  totalMinutes: number;
  averageWeeklyActivity: number;
  mostActiveDay: string;
  popularWorkoutTypes: string[];
  memberProgress: {
    improving: number;
    maintaining: number;
    declining: number;
  };
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromProfilePicture?: string;
  toUserId: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  sentAt: string;
  respondedAt?: string;
}

export interface Friend {
  id: string;
  userId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  isOnline: boolean;
  lastActive: string;
  friendshipSince: string;
  mutualFriends: number;
  sharedInterests: string[];
  recentActivity?: {
    type: string;
    description: string;
    timestamp: string;
  }[];
}

export interface SharedWorkout {
  id: string;
  workoutId: string;
  sharedBy: string;
  sharedByUsername: string;
  sharedByProfilePicture?: string;
  title: string;
  description?: string;
  type: 'strength' | 'cardio' | 'flexibility' | 'mixed';
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  exercises: number;
  tags: string[];
  visibility: 'public' | 'friends' | 'groups';
  targetGroups?: string[];
  likes: number;
  comments: number;
  shares: number;
  hasLiked: boolean;
  hasShared: boolean;
  sharedAt: string;
  stats?: {
    completions: number;
    averageRating: number;
    totalCaloriesBurned: number;
  };
}

export interface WorkoutComment {
  id: string;
  workoutId: string;
  userId: string;
  username: string;
  profilePicture?: string;
  content: string;
  likes: number;
  hasLiked: boolean;
  replies: WorkoutCommentReply[];
  createdAt: string;
  updatedAt?: string;
}

export interface WorkoutCommentReply {
  id: string;
  userId: string;
  username: string;
  profilePicture?: string;
  content: string;
  likes: number;
  hasLiked: boolean;
  createdAt: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'individual' | 'group' | 'global';
  category: 'distance' | 'duration' | 'frequency' | 'strength' | 'weight-loss' | 'custom';
  difficulty: 'easy' | 'medium' | 'hard';
  duration: {
    value: number;
    unit: 'days' | 'weeks' | 'months';
  };
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdBy: string;
  participants: number;
  maxParticipants?: number;
  rules: string[];
  rewards: ChallengeReward[];
  requirements: {
    fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
    equipment?: string[];
    timeCommitment?: number;
  };
  progress?: {
    completed: number;
    total: number;
    rank?: number;
  };
  leaderboard: ChallengeParticipant[];
  tags: string[];
  bannerImage?: string;
}

export interface ChallengeReward {
  type: 'badge' | 'points' | 'discount' | 'feature';
  name: string;
  description: string;
  value?: number;
  criteria: string;
}

export interface ChallengeParticipant {
  id: string;
  userId: string;
  username: string;
  profilePicture?: string;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  rank: number;
  joinedAt: string;
  lastUpdate: string;
  achievements: string[];
}

export interface WorkoutEvaluation {
  id: string;
  workoutId: string;
  evaluatorId: string;
  evaluatorUsername: string;
  evaluatorProfilePicture?: string;
  rating: number;
  difficulty: number;
  effectiveness: number;
  enjoyment: number;
  wouldRecommend: boolean;
  review?: string;
  tags: string[];
  pros: string[];
  cons: string[];
  suggestedImprovements: string[];
  targetAudience: string[];
  createdAt: string;
  helpful: number;
  hasMarkedHelpful: boolean;
}

export interface ActivityFeed {
  id: string;
  type: 'workout_completed' | 'workout_shared' | 'challenge_joined' | 'achievement_unlocked' | 'friend_added' | 'group_joined';
  userId: string;
  username: string;
  profilePicture?: string;
  content: {
    title: string;
    description: string;
    metadata?: any;
  };
  visibility: 'public' | 'friends' | 'private';
  likes: number;
  comments: number;
  hasLiked: boolean;
  timestamp: string;
}

export interface CreateGroupRequest {
  name: string;
  description: string;
  type: 'public' | 'private' | 'invite-only';
  category: string;
  maxMembers?: number;
  tags: string[];
  rules?: string[];
  location?: {
    type: 'online' | 'in-person' | 'hybrid';
    city?: string;
    region?: string;
    venue?: string;
  };
  schedule?: {
    recurring: boolean;
    days?: string[];
    time?: string;
    timezone?: string;
  };
}

export interface UpdateGroupRequest {
  group_name?: string;
  description?: string;
  is_private?: boolean;
  max_members?: number;
  group_image?: string;
  [key: string]: any;
}

export interface JoinGroupRequest {
  groupId: string;
  message?: string;
}

export interface SendFriendRequestRequest {
  userId: string;
  message?: string;
}

export interface ShareWorkoutRequest {
  workoutId: string;
  description?: string;
  visibility: 'public' | 'friends' | 'groups';
  targetGroups?: string[];
  tags?: string[];
}

export interface CreateChallengeRequest {
  title: string;
  description: string;
  type: 'individual' | 'group' | 'global';
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  duration: {
    value: number;
    unit: 'days' | 'weeks' | 'months';
  };
  startDate: string;
  maxParticipants?: number;
  rules: string[];
  rewards: ChallengeReward[];
  requirements?: any;
  tags: string[];
}

export interface EvaluateWorkoutRequest {
  workoutId: string;
  rating: number;
  difficulty: number;
  effectiveness: number;
  enjoyment: number;
  wouldRecommend: boolean;
  review?: string;
  tags?: string[];
  pros?: string[];
  cons?: string[];
  suggestedImprovements?: string[];
  targetAudience?: string[];
}

export class SocialService {
  // Group Management
  public async createGroup(request: CreateGroupRequest | any): Promise<Group> {
    try {
      const response = await apiClient.post<Group>('social', '/api/groups', request);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to create group');
    }
  }

  public async getGroups(filters?: {
    category?: string;
    type?: string;
    location?: string;
    search?: string;
    page?: number;
    limit?: number;
    user_id?: number;
  }): Promise<{ groups: Group[]; total: number; page: number; limit: number }> {
    try {
      const params = new URLSearchParams(filters as any).toString();
      const response = await apiClient.get('social', `/api/groups?${params}`);

      // Laravel returns data in response.data.data format
      const rawData = response.data.data || response.data;

      // Transform Laravel response to frontend format
      const transformedGroups: Group[] = (rawData.data || []).map((group: any) => {
        // Use actual stats from backend if available
        const backendStats = group.stats || {};
        return {
          id: group.group_id?.toString(),
          name: group.group_name,
          description: group.description,
          type: group.is_private ? 'private' : 'public',
          category: 'fitness',
          memberCount: group.current_member_count || 0,
          maxMembers: group.max_members,
          isActive: group.is_active,
          createdBy: group.created_by?.toString(),
          moderators: [],
          tags: [],
          groupImage: group.group_image,
          groupCode: group.group_code,
          achievements: [],
          stats: {
            totalWorkouts: backendStats.total_workouts || 0,
            totalMinutes: backendStats.total_minutes || 0,
            averageWeeklyActivity: backendStats.weekly_average || 0,
            mostActiveDay: '',
            popularWorkoutTypes: [],
            memberProgress: { improving: 0, maintaining: 0, declining: 0 }
          },
          createdAt: group.created_at,
          updatedAt: group.updated_at
        };
      });

      return {
        groups: transformedGroups,
        total: rawData.total || transformedGroups.length,
        page: rawData.current_page || 1,
        limit: rawData.per_page || 10
      };
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get groups');
    }
  }

  public async getGroup(groupId: string): Promise<Group> {
    try {
      const response = await apiClient.get('social', `/api/groups/${groupId}`);

      // Transform Laravel response to frontend format
      const rawGroup = response.data.data || response.data;

      console.log('🔍 Raw Group Data from Backend:', {
        group_id: rawGroup.group_id,
        group_name: rawGroup.group_name,
        group_code: rawGroup.group_code,
        has_group_code: !!rawGroup.group_code
      });

      // Use actual stats from backend if available, otherwise default to zeros
      const backendStats = rawGroup.stats || {};

      const transformedGroup: Group = {
        id: rawGroup.group_id?.toString(),
        name: rawGroup.group_name,
        description: rawGroup.description,
        type: rawGroup.is_private ? 'private' : 'public',
        category: 'fitness',
        memberCount: rawGroup.current_member_count || 0,
        maxMembers: rawGroup.max_members,
        isActive: rawGroup.is_active,
        createdBy: rawGroup.created_by?.toString(),
        moderators: [],
        tags: [],
        groupImage: rawGroup.group_image,
        groupCode: rawGroup.group_code,
        achievements: [],
        stats: {
          totalWorkouts: backendStats.total_workouts || 0,
          totalMinutes: backendStats.total_minutes || 0,
          averageWeeklyActivity: backendStats.weekly_average || 0,
          mostActiveDay: '',
          popularWorkoutTypes: [],
          memberProgress: { improving: 0, maintaining: 0, declining: 0 }
        },
        createdAt: rawGroup.created_at,
        updatedAt: rawGroup.updated_at
      };

      console.log('📊 Group Stats from Backend:', backendStats);

      return transformedGroup;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get group');
    }
  }

  public async updateGroup(groupId: string, updates: UpdateGroupRequest): Promise<Group> {
    try {
      const response = await apiClient.put<Group>('social', `/api/groups/${groupId}`, updates);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to update group');
    }
  }

  public async deleteGroup(groupId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<{ message: string }>('social', `/api/groups/${groupId}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to delete group');
    }
  }

  public async joinGroup(request: JoinGroupRequest): Promise<{ message: string }> {
    try {
      // Join public group by ID
      const response = await apiClient.post<{ message: string }>('social', `/api/groups/${request.groupId}/join`, {
        message: request.message
      });
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to join group');
    }
  }

  public async joinGroupWithCode(groupCode: string, message?: string): Promise<{ message: string }> {
    try {
      // Join group using 8-character code
      const response = await apiClient.post<{ message: string }>('social', '/api/groups/join-with-code', {
        group_code: groupCode,
        message: message
      });
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to join group with code');
    }
  }

  public async leaveGroup(groupId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<{ message: string }>('social', `/api/groups/${groupId}/leave`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to leave group');
    }
  }

  public async getGroupMembers(groupId: string, page = 1, limit = 20): Promise<{
    members: GroupMember[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const response = await apiClient.get('social', `/api/groups/${groupId}/members?page=${page}&limit=${limit}`);

      // Transform Laravel response
      const rawData = response.data.data || response.data;

      const transformedMembers: GroupMember[] = (rawData.data || rawData.members || []).map((member: any) => {
        // Map backend role to frontend role
        let role: 'owner' | 'moderator' | 'member' = 'member';
        if (member.member_role === 'admin') {
          role = 'owner';
        } else if (member.member_role === 'moderator') {
          role = 'moderator';
        }

        return {
          id: member.group_member_id?.toString() || member.id?.toString(),
          userId: member.user_id?.toString(),
          username: member.username || `User ${member.user_id}`,
          profilePicture: member.profile_picture,
          role: role,
          joinedAt: member.joined_at,
          lastActive: member.last_active || member.joined_at,
          contributions: {
            workoutsShared: 0,
            challengesCreated: 0,
            helpfulPosts: 0
          },
          status: member.is_active ? 'active' : 'inactive'
        };
      });

      return {
        members: transformedMembers,
        total: rawData.total || transformedMembers.length,
        page: rawData.current_page || page,
        limit: rawData.per_page || limit
      };
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get group members');
    }
  }

  public async updateMemberRole(groupId: string, userId: string, role: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.put<{ message: string }>('social', `/api/groups/${groupId}/members/${userId}`, { role });
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to update member role');
    }
  }

  public async removeGroupMember(groupId: string, userId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<{ message: string }>('social', `/api/groups/${groupId}/members/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to remove group member');
    }
  }

  public async inviteUser(groupId: string, userIdOrUsername: string): Promise<{ message: string }> {
    try {
      // Try to parse as number first to determine if it's user_id or username
      const isNumeric = !isNaN(Number(userIdOrUsername));
      const payload = isNumeric
        ? { user_id: parseInt(userIdOrUsername) }
        : { username: userIdOrUsername };

      const response = await apiClient.post<{ message: string }>('social', `/api/groups/${groupId}/invite`, payload);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to invite user to group');
    }
  }

  // Friend Management
  public async sendFriendRequest(request: SendFriendRequestRequest): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('social', '/social/friends/request', request);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to send friend request');
    }
  }

  public async respondToFriendRequest(requestId: string, action: 'accept' | 'decline'): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('social', `/social/friends/request/${requestId}/${action}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || `Failed to ${action} friend request`);
    }
  }

  public async getFriendRequests(type: 'sent' | 'received' = 'received'): Promise<FriendRequest[]> {
    try {
      const response = await apiClient.get<FriendRequest[]>('social', `/social/friends/requests?type=${type}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get friend requests');
    }
  }

  public async getFriends(page = 1, limit = 20): Promise<{
    friends: Friend[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const response = await apiClient.get<{
        friends: Friend[];
        total: number;
        page: number;
        limit: number;
      }>('social', `/social/friends?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get friends');
    }
  }

  public async removeFriend(userId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<{ message: string }>('social', `/social/friends/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to remove friend');
    }
  }

  public async searchUsers(query: string, filters?: {
    location?: string;
    interests?: string[];
    fitnessLevel?: string;
  }): Promise<{
    users: Array<{
      id: string;
      username: string;
      profilePicture?: string;
      mutualFriends: number;
      sharedInterests: string[];
      location?: string;
    }>;
  }> {
    try {
      const params = new URLSearchParams({ query, ...filters } as any).toString();
      const response = await apiClient.get<{
        users: Array<{
          id: string;
          username: string;
          profilePicture?: string;
          mutualFriends: number;
          sharedInterests: string[];
          location?: string;
        }>;
      }>('social', `/api/users/search?${params}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to search users');
    }
  }

  // Workout Sharing
  public async shareWorkout(request: ShareWorkoutRequest): Promise<SharedWorkout> {
    try {
      const response = await apiClient.post<SharedWorkout>('social', '/social/workouts/share', request);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to share workout');
    }
  }

  public async getSharedWorkouts(filters?: {
    visibility?: string;
    groupId?: string;
    userId?: string;
    type?: string;
    difficulty?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    workouts: SharedWorkout[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const params = new URLSearchParams(filters as any).toString();
      const response = await apiClient.get<{
        workouts: SharedWorkout[];
        total: number;
        page: number;
        limit: number;
      }>('social', `/social/workouts?${params}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get shared workouts');
    }
  }

  public async likeWorkout(workoutId: string): Promise<{ message: string; likes: number }> {
    try {
      const response = await apiClient.post<{ message: string; likes: number }>('social', `/social/workouts/${workoutId}/like`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to like workout');
    }
  }

  public async unlikeWorkout(workoutId: string): Promise<{ message: string; likes: number }> {
    try {
      const response = await apiClient.delete<{ message: string; likes: number }>('social', `/social/workouts/${workoutId}/like`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to unlike workout');
    }
  }

  public async addWorkoutComment(workoutId: string, content: string): Promise<WorkoutComment> {
    try {
      const response = await apiClient.post<WorkoutComment>('social', `/social/workouts/${workoutId}/comments`, { content });
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to add comment');
    }
  }

  public async getWorkoutComments(workoutId: string, page = 1, limit = 20): Promise<{
    comments: WorkoutComment[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const response = await apiClient.get<{
        comments: WorkoutComment[];
        total: number;
        page: number;
        limit: number;
      }>('social', `/social/workouts/${workoutId}/comments?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get comments');
    }
  }

  public async replyToComment(commentId: string, content: string): Promise<WorkoutCommentReply> {
    try {
      const response = await apiClient.post<WorkoutCommentReply>('social', `/social/comments/${commentId}/replies`, { content });
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to reply to comment');
    }
  }

  // Challenges
  public async createChallenge(request: CreateChallengeRequest): Promise<Challenge> {
    try {
      const response = await apiClient.post<Challenge>('social', '/social/challenges', request);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to create challenge');
    }
  }

  public async getChallenges(filters?: {
    type?: string;
    category?: string;
    difficulty?: string;
    status?: 'active' | 'upcoming' | 'completed';
    page?: number;
    limit?: number;
  }): Promise<{
    challenges: Challenge[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const params = new URLSearchParams(filters as any).toString();
      const response = await apiClient.get<{
        challenges: Challenge[];
        total: number;
        page: number;
        limit: number;
      }>('social', `/social/challenges?${params}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get challenges');
    }
  }

  public async joinChallenge(challengeId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('social', `/social/challenges/${challengeId}/join`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to join challenge');
    }
  }

  public async leaveChallenge(challengeId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('social', `/social/challenges/${challengeId}/leave`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to leave challenge');
    }
  }

  public async updateChallengeProgress(challengeId: string, progress: any): Promise<{ message: string }> {
    try {
      const response = await apiClient.put<{ message: string }>('social', `/social/challenges/${challengeId}/progress`, progress);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to update challenge progress');
    }
  }

  // Workout Evaluations
  public async evaluateWorkout(request: EvaluateWorkoutRequest): Promise<WorkoutEvaluation> {
    try {
      const response = await apiClient.post<WorkoutEvaluation>('social', '/social/evaluations', request);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to evaluate workout');
    }
  }

  public async getWorkoutEvaluations(workoutId: string, page = 1, limit = 20): Promise<{
    evaluations: WorkoutEvaluation[];
    total: number;
    averageRating: number;
    averageDifficulty: number;
    averageEffectiveness: number;
    averageEnjoyment: number;
    recommendationPercentage: number;
    page: number;
    limit: number;
  }> {
    try {
      const response = await apiClient.get<{
        evaluations: WorkoutEvaluation[];
        total: number;
        averageRating: number;
        averageDifficulty: number;
        averageEffectiveness: number;
        averageEnjoyment: number;
        recommendationPercentage: number;
        page: number;
        limit: number;
      }>('social', `/social/workouts/${workoutId}/evaluations?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get workout evaluations');
    }
  }

  public async markEvaluationHelpful(evaluationId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('social', `/social/evaluations/${evaluationId}/helpful`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to mark evaluation as helpful');
    }
  }

  // Activity Feed
  public async getActivityFeed(filters?: {
    type?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    activities: ActivityFeed[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const params = new URLSearchParams(filters as any).toString();
      const response = await apiClient.get<{
        activities: ActivityFeed[];
        total: number;
        page: number;
        limit: number;
      }>('social', `/social/feed?${params}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get activity feed');
    }
  }

  public async likeActivity(activityId: string): Promise<{ message: string; likes: number }> {
    try {
      const response = await apiClient.post<{ message: string; likes: number }>('social', `/social/feed/${activityId}/like`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to like activity');
    }
  }

  // Statistics and Analytics
  public async getSocialStats(): Promise<{
    friends: number;
    groups: number;
    sharedWorkouts: number;
    challengesCompleted: number;
    totalLikes: number;
    evaluationsGiven: number;
    helpfulVotes: number;
  }> {
    try {
      const response = await apiClient.get<{
        friends: number;
        groups: number;
        sharedWorkouts: number;
        challengesCompleted: number;
        totalLikes: number;
        evaluationsGiven: number;
        helpfulVotes: number;
      }>('social', '/social/stats');
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get social stats');
    }
  }

  // Group Workout Invitations
  public async initiateGroupWorkout(
    groupId: string,
    workoutData: any
  ): Promise<{
    session_id: string;
    group_id: string;
    initiator_id: number;
    workout_data: any;
  }> {
    try {
      console.log('📤 [SOCIAL] Initiating group workout:', {
        groupId,
        workoutData,
        payload: { workout_data: workoutData }
      });

      const response = await apiClient.post(
        'social',
        `/api/groups/${groupId}/initiate-workout`,
        { workout_data: workoutData }
      );

      console.log('✅ [SOCIAL] Group workout initiated successfully:', response.data);
      return response.data.data;
    } catch (error: any) {
      console.error('❌ [SOCIAL] Failed to initiate group workout - FULL ERROR DETAILS:', {
        errorObject: error,
        message: error.message,
        isAxiosError: error.isAxiosError,
        hasResponse: !!error.response,
        hasRequest: !!error.request,
        response: error.response?.data,
        status: error.response?.status,
        errors: error.response?.data?.errors,
        code: error.code,
        config: error.config ? {
          url: error.config.url,
          baseURL: error.config.baseURL,
          method: error.config.method,
          data: error.config.data
        } : undefined
      });

      // Include validation errors in the error message if available
      const validationErrors = error.response?.data?.errors;
      if (validationErrors) {
        const errorMessages = Object.entries(validationErrors)
          .map(([field, messages]: [string, any]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
          .join('; ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }

      throw error; // Re-throw the original error to preserve the full error object
    }
  }

  // Workout Lobby
  public async startWorkout(sessionId: string): Promise<{
    session_id: string;
    start_time: number;
  }> {
    try {
      const response = await apiClient.post(
        'social',
        `/api/lobby/${sessionId}/start`,
        {}
      );
      return response.data.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to start workout');
    }
  }

  public async broadcastExercises(
    sessionId: string,
    workoutData: any
  ): Promise<void> {
    try {
      console.log('📤 [SOCIAL] Broadcasting exercises to lobby:', {
        sessionId,
        exercisesCount: workoutData.exercises?.length || 0
      });

      await apiClient.post(
        'social',
        `/api/lobby/${sessionId}/broadcast-exercises`,
        {
          workout_data: workoutData
        }
      );

      console.log('✅ [SOCIAL] Exercises broadcast successfully');
    } catch (error) {
      console.error('❌ [SOCIAL] Failed to broadcast exercises:', error);
      throw new Error((error as any).message || 'Failed to broadcast exercises');
    }
  }






  // Workout Session Control (Server-Authoritative)
  public async pauseWorkout(sessionId: string): Promise<{
    session_id: string;
    paused_at: number;
  }> {
    try {
      const response = await apiClient.post(
        'social',
        `/api/session/${sessionId}/pause`,
        {}
      );
      return response.data.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to pause workout');
    }
  }

  public async resumeWorkout(sessionId: string): Promise<{
    session_id: string;
    resumed_at: number;
  }> {
    try {
      const response = await apiClient.post(
        'social',
        `/api/session/${sessionId}/resume`,
        {}
      );
      return response.data.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to resume workout');
    }
  }

  public async stopWorkout(sessionId: string): Promise<{
    session_id: string;
    stopped_at: number;
  }> {
    try {
      const response = await apiClient.post(
        'social',
        `/api/session/${sessionId}/stop`,
        {}
      );
      return response.data.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to stop workout');
    }
  }

  public async finishWorkout(sessionId: string): Promise<{
    session_id: string;
    finished_at: number;
  }> {
    try {
      console.log('📤 [SOCIAL] Finishing workout for all members:', { sessionId });
      const response = await apiClient.post(
        'social',
        `/api/session/${sessionId}/finish`,
        {}
      );
      console.log('✅ [SOCIAL] Workout finished successfully');
      return response.data.data;
    } catch (error) {
      console.error('❌ [SOCIAL] Failed to finish workout:', error);
      throw new Error((error as any).message || 'Failed to finish workout');
    }
  }

  // ============================================================================
  // V2 Event-Sourced Lobby API (Professional Architecture)
  // ============================================================================

  public async createLobbyV2(
    groupId: number,
    workoutData: any
  ): Promise<{
    status: string;
    data: {
      session_id: string;
      lobby_state: any;
      version: number;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Creating lobby:', { groupId, workoutData });
      const response = await apiClient.post(
        'social',
        '/api/v2/lobby/create',
        {
          group_id: groupId,
          workout_data: workoutData
        }
      );
      console.log('✅ [SOCIAL V2] Lobby created successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to create lobby:', error);
      throw new Error((error as any).message || 'Failed to create lobby');
    }
  }

  public async getLobbyStateV2(
    sessionId: string
  ): Promise<{
    status: string;
    data: {
      lobby_state: any;
      version: number;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Fetching lobby state:', { sessionId });
      const response = await apiClient.get(
        'social',
        `/api/v2/lobby/${sessionId}`
      );
      console.log('✅ [SOCIAL V2] Lobby state fetched successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to fetch lobby state:', error);
      throw new Error((error as any).message || 'Failed to fetch lobby state');
    }
  }

  public async joinLobbyV2(
    sessionId: string
  ): Promise<{
    status: string;
    data: {
      lobby_state: any;
      version: number;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Joining lobby:', { sessionId });
      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/join`,
        {}
      );
      console.log('✅ [SOCIAL V2] Joined lobby successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to join lobby:', error);
      throw new Error((error as any).message || 'Failed to join lobby');
    }
  }

  public async updateLobbyStatusV2(
    sessionId: string,
    status: 'waiting' | 'ready'
  ): Promise<{
    status: string;
    data: {
      lobby_state: any;
      version: number;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Updating lobby status:', { sessionId, status });
      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/status`,
        { status }
      );
      console.log('✅ [SOCIAL V2] Lobby status updated successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to update lobby status:', error);
      throw new Error((error as any).message || 'Failed to update lobby status');
    }
  }

  public async leaveLobbyV2(
    sessionId: string
  ): Promise<{
    status: string;
    data: {
      lobby_state: any;
      version: number;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Leaving lobby:', { sessionId });
      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/leave`,
        {}
      );
      console.log('✅ [SOCIAL V2] Left lobby successfully');
      return response.data;
    } catch (error: any) {
      // Check if error is "not in lobby" - this is an expected state, not a failure
      const errorMessage = error?.message || '';
      const isNotInLobbyError = errorMessage.includes('You are not in this lobby') ||
                                errorMessage.includes('not in this lobby') ||
                                errorMessage.includes('already left');

      if (isNotInLobbyError) {
        console.log('ℹ️ [SOCIAL V2] User already left lobby or not in lobby - treating as success');
        // Return a success response since the desired end state is achieved
        return {
          status: 'success',
          data: {
            lobby_state: null,
            version: 0
          }
        };
      }

      // For other errors, log and throw
      console.error('❌ [SOCIAL V2] Failed to leave lobby:', error);
      throw new Error(errorMessage || 'Failed to leave lobby');
    }
  }

  public async updateWorkoutDataV2(
    sessionId: string,
    workoutData: any
  ): Promise<{
    status: string;
    data: {
      lobby_state: any;
      version: number;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Updating workout data:', { sessionId });
      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/workout-data`,
        { workout_data: workoutData }
      );
      console.log('✅ [SOCIAL V2] Workout data updated successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to update workout data:', error);
      throw new Error((error as any).message || 'Failed to update workout data');
    }
  }

  public async deleteLobbyV2(
    sessionId: string
  ): Promise<{
    status: string;
    message: string;
  }> {
    try {
      console.log('📤 [SOCIAL V2] Deleting lobby:', { sessionId });
      const response = await apiClient.delete(
        'social',
        `/api/v2/lobby/${sessionId}`
      );
      console.log('✅ [SOCIAL V2] Lobby deleted successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to delete lobby:', error);
      throw new Error((error as any).message || 'Failed to delete lobby');
    }
  }

  public async passInitiatorRoleV2(
    sessionId: string,
    newInitiatorId: number
  ): Promise<{
    status: string;
    data: {
      lobby_state: any;
      version: number;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Passing initiator role:', { sessionId, newInitiatorId });
      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/pass-initiator`,
        { new_initiator_id: newInitiatorId }
      );
      console.log('✅ [SOCIAL V2] Initiator role passed successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to pass initiator role:', error);
      throw new Error((error as any).message || 'Failed to pass initiator role');
    }
  }

  public async startWorkoutV2(
    sessionId: string
  ): Promise<{
    status: string;
    data: {
      session_id: string;
      start_time: number;
      lobby_state: any;
      version: number;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Starting workout:', { sessionId });
      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/start`,
        {}
      );
      console.log('✅ [SOCIAL V2] Workout started successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to start workout:', error);
      throw new Error((error as any).message || 'Failed to start workout');
    }
  }

  public async sendLobbyMessageV2(
    sessionId: string,
    message: string,
    isSystemMessage: boolean = false
  ): Promise<{
    status: string;
    data: {
      message_id: string;
      timestamp: number;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Sending lobby chat message:', {
        sessionId,
        messageLength: message.length,
        isSystemMessage
      });

      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/message`,
        {
          message,
          is_system_message: isSystemMessage
        }
      );

      console.log('✅ [SOCIAL V2] Chat message sent successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to send chat message:', error);
      throw new Error((error as any).message || 'Failed to send chat message');
    }
  }

  public async getChatMessagesV2(
    sessionId: string,
    options?: {
      limit?: number;
      before?: string;
    }
  ): Promise<{
    status: string;
    data: {
      messages: Array<{
        message_id: string;
        user_id: number;
        user_name?: string;
        message: string;
        timestamp: number;
        is_system_message: boolean;
      }>;
      has_more: boolean;
      count: number;
    };
  }> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.before) params.append('before', options.before);

      const queryString = params.toString();
      const url = `/api/v2/lobby/${sessionId}/messages${queryString ? `?${queryString}` : ''}`;

      console.log('📤 [SOCIAL V2] Fetching chat messages:', { sessionId, options });

      const response = await apiClient.get('social', url);

      console.log('✅ [SOCIAL V2] Chat messages fetched successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to fetch chat messages:', error);
      throw new Error((error as any).message || 'Failed to fetch chat messages');
    }
  }

  public async inviteMemberToLobbyV2(
    sessionId: string,
    invitedUserId: number,
    groupId: number,
    workoutData: any
  ): Promise<{
    status: string;
    message: string;
  }> {
    try {
      console.log('📤 [SOCIAL V2] Sending lobby invitation:', {
        sessionId,
        invitedUserId,
        groupId
      });

      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/invite`,
        {
          invited_user_id: invitedUserId,
          group_id: groupId,
          workout_data: workoutData
        }
      );

      console.log('✅ [SOCIAL V2] Lobby invitation sent successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to send lobby invitation:', error);
      throw new Error((error as any).message || 'Failed to send lobby invitation');
    }
  }

  public async kickMemberFromLobbyV2(
    sessionId: string,
    kickedUserId: number
  ): Promise<{
    status: string;
    data: {
      lobby_state: any;
      version: number;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Kicking user from lobby:', {
        sessionId,
        kickedUserId
      });

      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/kick`,
        {
          kicked_user_id: kickedUserId
        }
      );

      console.log('✅ [SOCIAL V2] User kicked successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to kick user:', error);
      throw new Error((error as any).message || 'Failed to kick user from lobby');
    }
  }

  public async transferInitiatorRoleV2(
    sessionId: string,
    newInitiatorId: number
  ): Promise<{
    status: string;
    message: string;
    data: {
      lobby_state: any;
      version: number;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Transferring initiator role:', {
        sessionId,
        newInitiatorId
      });

      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/transfer-initiator`,
        {
          new_initiator_id: newInitiatorId
        }
      );

      console.log('✅ [SOCIAL V2] Initiator role transferred successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to transfer initiator role:', error);
      throw new Error((error as any).message || 'Failed to transfer initiator role');
    }
  }

  public async forceLeaveAllLobbies(): Promise<{
    status: string;
    message: string;
    data: {
      lobbies_left: number;
      errors: any[];
    };
  }> {
    try {
      console.log('🔥 [SOCIAL V2] Force leaving all active lobbies');

      const response = await apiClient.post(
        'social',
        '/api/v2/lobby/force-leave-all',
        {}
      );

      console.log('✅ [SOCIAL V2] Force leave successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to force leave lobbies:', error);
      throw new Error((error as any).message || 'Failed to force leave lobbies');
    }
  }

  // ============================================================================
  // V2 Invitation Management (Professional Persistence)
  // ============================================================================

  public async acceptInvitation(
    invitationId: string
  ): Promise<{
    status: string;
    message: string;
    data: {
      session_id: string;
      lobby_state: any;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Accepting invitation:', { invitationId });

      const response = await apiClient.post(
        'social',
        `/api/v2/invitations/${invitationId}/accept`,
        {}
      );

      console.log('✅ [SOCIAL V2] Invitation accepted successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to accept invitation:', error);
      throw new Error((error as any).message || 'Failed to accept invitation');
    }
  }

  public async declineInvitation(
    invitationId: string
  ): Promise<{
    status: string;
    message: string;
  }> {
    try {
      console.log('📤 [SOCIAL V2] Declining invitation:', { invitationId });

      const response = await apiClient.post(
        'social',
        `/api/v2/invitations/${invitationId}/decline`,
        {}
      );

      console.log('✅ [SOCIAL V2] Invitation declined successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to decline invitation:', error);
      throw new Error((error as any).message || 'Failed to decline invitation');
    }
  }

  public async getPendingInvitations(): Promise<{
    status: string;
    message: string;
    data: {
      invitations: Array<{
        invitation_id: string;
        session_id: string;
        group_id: number;
        initiator_id: number;
        initiator_name: string;
        workout_data: any;
        expires_at: number;
        sent_at: string;
      }>;
      count: number;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Fetching pending invitations');

      const response = await apiClient.get(
        'social',
        '/api/v2/invitations/pending'
      );

      console.log('✅ [SOCIAL V2] Pending invitations fetched successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to fetch pending invitations:', error);
      throw new Error((error as any).message || 'Failed to fetch pending invitations');
    }
  }

  // ============================================================================
  // JOIN REQUEST METHODS (Approval System)
  // ============================================================================

  /**
   * Create a join request for a group
   * POST /api/groups/{groupId}/join-requests
   */
  public async createJoinRequest(groupId: string, message?: string): Promise<{
    status: string;
    message: string;
    data: { request_id: number; status: string };
  }> {
    try {
      console.log('📤 [SOCIAL] Creating join request for group:', groupId);

      const response = await apiClient.post(
        'social',
        `/api/groups/${groupId}/join-requests`,
        { message }
      );

      console.log('✅ [SOCIAL] Join request created successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL] Failed to create join request:', error);
      throw new Error((error as any).message || 'Failed to create join request');
    }
  }

  /**
   * Get pending join requests for a group (owner/moderator only)
   * GET /api/groups/{groupId}/join-requests
   */
  public async getJoinRequests(groupId: string): Promise<{
    status: string;
    data: {
      requests: Array<{
        request_id: number;
        user_id: number;
        username: string;
        user_role: string;
        message?: string;
        requested_at: string;
      }>;
      total: number;
    };
  }> {
    try {
      console.log('📤 [SOCIAL] Fetching join requests for group:', groupId);

      const response = await apiClient.get(
        'social',
        `/api/groups/${groupId}/join-requests`
      );

      console.log('✅ [SOCIAL] Join requests fetched successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL] Failed to fetch join requests:', error);
      throw new Error((error as any).message || 'Failed to fetch join requests');
    }
  }

  /**
   * Get pending join request count for a group
   * GET /api/groups/{groupId}/join-requests/count
   */
  public async getJoinRequestCount(groupId: string): Promise<number> {
    try {
      console.log('📤 [SOCIAL] Fetching join request count for group:', groupId);

      const response = await apiClient.get(
        'social',
        `/api/groups/${groupId}/join-requests/count`
      );

      const count = response.data?.data?.count || 0;
      console.log('✅ [SOCIAL] Join request count:', count);
      return count;
    } catch (error) {
      console.error('❌ [SOCIAL] Failed to fetch join request count:', error);
      return 0;
    }
  }

  /**
   * Approve a join request
   * POST /api/groups/{groupId}/join-requests/{requestId}/approve
   */
  public async approveJoinRequest(groupId: string, requestId: number): Promise<{
    status: string;
    message: string;
  }> {
    try {
      console.log('📤 [SOCIAL] Approving join request:', { groupId, requestId });

      const response = await apiClient.post(
        'social',
        `/api/groups/${groupId}/join-requests/${requestId}/approve`,
        {}
      );

      console.log('✅ [SOCIAL] Join request approved successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL] Failed to approve join request:', error);
      throw new Error((error as any).message || 'Failed to approve join request');
    }
  }

  /**
   * Reject a join request
   * POST /api/groups/{groupId}/join-requests/{requestId}/reject
   */
  public async rejectJoinRequest(groupId: string, requestId: number, reason?: string): Promise<{
    status: string;
    message: string;
  }> {
    try {
      console.log('📤 [SOCIAL] Rejecting join request:', { groupId, requestId });

      const response = await apiClient.post(
        'social',
        `/api/groups/${groupId}/join-requests/${requestId}/reject`,
        { reason }
      );

      console.log('✅ [SOCIAL] Join request rejected successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL] Failed to reject join request:', error);
      throw new Error((error as any).message || 'Failed to reject join request');
    }
  }

  /**
   * Cancel user's own pending join request
   * DELETE /api/groups/{groupId}/join-requests
   */
  public async cancelJoinRequest(groupId: string): Promise<{
    status: string;
    message: string;
  }> {
    try {
      console.log('📤 [SOCIAL] Cancelling join request for group:', groupId);

      const response = await apiClient.delete(
        'social',
        `/api/groups/${groupId}/join-requests`
      );

      console.log('✅ [SOCIAL] Join request cancelled successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL] Failed to cancel join request:', error);
      throw new Error((error as any).message || 'Failed to cancel join request');
    }
  }

  /**
   * Get user's own join requests
   * GET /api/user/join-requests
   */
  public async getUserJoinRequests(): Promise<{
    status: string;
    data: Array<{
      request_id: number;
      group_id: number;
      group_name: string;
      status: 'pending' | 'approved' | 'rejected';
      message?: string;
      rejection_reason?: string;
      requested_at: string;
      responded_at?: string;
    }>;
  }> {
    try {
      console.log('📤 [SOCIAL] Fetching user join requests');

      const response = await apiClient.get(
        'social',
        '/api/user/join-requests'
      );

      console.log('✅ [SOCIAL] User join requests fetched successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL] Failed to fetch user join requests:', error);
      throw new Error((error as any).message || 'Failed to fetch user join requests');
    }
  }

  // ============================================================================
  // READY CHECK METHODS (Lobby Ready Check System)
  // ============================================================================

  /**
   * Start a ready check in the lobby
   * This broadcasts a ReadyCheckStarted event to all lobby members
   * POST /api/v2/lobby/{sessionId}/ready-check/start
   */
  public async startReadyCheckV2(
    sessionId: string,
    timeoutSeconds: number = 25
  ): Promise<{
    status: string;
    message: string;
    data: {
      ready_check_id: string;
      expires_at: number;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Starting ready check:', { sessionId, timeoutSeconds });

      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/ready-check/start`,
        { timeout_seconds: timeoutSeconds }
      );

      console.log('✅ [SOCIAL V2] Ready check started successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to start ready check:', error);
      throw new Error((error as any).message || 'Failed to start ready check');
    }
  }

  /**
   * Respond to a ready check (accept or decline)
   * This broadcasts a ReadyCheckResponse event to all lobby members
   * POST /api/v2/lobby/{sessionId}/ready-check/respond
   */
  public async respondToReadyCheckV2(
    sessionId: string,
    response: 'accepted' | 'declined'
  ): Promise<{
    status: string;
    message: string;
    data: {
      all_accepted: boolean;
      responses: Record<number, string>;
    };
  }> {
    try {
      console.log('📤 [SOCIAL V2] Responding to ready check:', { sessionId, response });

      const apiResponse = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/ready-check/respond`,
        { response }
      );

      console.log('✅ [SOCIAL V2] Ready check response sent successfully');
      return apiResponse.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to respond to ready check:', error);
      throw new Error((error as any).message || 'Failed to respond to ready check');
    }
  }

  /**
   * Cancel an active ready check (initiator only)
   * POST /api/v2/lobby/{sessionId}/ready-check/cancel
   */
  public async cancelReadyCheckV2(
    sessionId: string
  ): Promise<{
    status: string;
    message: string;
  }> {
    try {
      console.log('📤 [SOCIAL V2] Cancelling ready check:', { sessionId });

      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/ready-check/cancel`,
        {}
      );

      console.log('✅ [SOCIAL V2] Ready check cancelled successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [SOCIAL V2] Failed to cancel ready check:', error);
      throw new Error((error as any).message || 'Failed to cancel ready check');
    }
  }

  // ============================================================================
  // VOTING METHODS (Group Workout Voting System)
  // ============================================================================

  /**
   * Start voting for exercises
   * POST /api/v2/lobby/{sessionId}/voting/start
   */
  public async startVoting(
    sessionId: string,
    data: {
      exercises: any[];
      alternative_pool?: any[];
      timeout_seconds?: number;
    }
  ): Promise<{
    status: string;
    message: string;
    data?: {
      voting_id: string;
      expires_at: number;
    };
  }> {
    try {
      console.log('[SOCIAL V2] Starting voting:', { sessionId });

      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/voting/start`,
        data
      );

      console.log('[SOCIAL V2] Voting started successfully');
      return response.data;
    } catch (error) {
      console.error('[SOCIAL V2] Failed to start voting:', error);
      throw new Error((error as any).message || 'Failed to start voting');
    }
  }

  /**
   * Submit a vote (accept or customize)
   * POST /api/v2/lobby/{sessionId}/voting/submit
   */
  public async submitVote(
    sessionId: string,
    data: {
      vote: 'accept' | 'customize';
    }
  ): Promise<{
    status: string;
    message: string;
    data?: {
      accept_count: number;
      customize_count: number;
      total_votes: number;
      total_members: number;
    };
  }> {
    try {
      console.log('[SOCIAL V2] Submitting vote:', { sessionId, vote: data.vote });

      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/voting/submit`,
        data
      );

      console.log('[SOCIAL V2] Vote submitted successfully');
      return response.data;
    } catch (error) {
      console.error('[SOCIAL V2] Failed to submit vote:', error);
      throw new Error((error as any).message || 'Failed to submit vote');
    }
  }

  /**
   * Force complete voting (on timeout)
   * POST /api/v2/lobby/{sessionId}/voting/complete
   */
  public async forceCompleteVoting(
    sessionId: string
  ): Promise<{
    status: string;
    message: string;
    data?: {
      result: string;
      reason: string;
      accept_count: number;
      customize_count: number;
      final_exercises: any[];
    };
  }> {
    try {
      console.log('[SOCIAL V2] Force completing voting:', { sessionId });

      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/voting/complete`,
        {}
      );

      console.log('[SOCIAL V2] Voting completed successfully');
      return response.data;
    } catch (error) {
      console.error('[SOCIAL V2] Failed to complete voting:', error);
      throw new Error((error as any).message || 'Failed to complete voting');
    }
  }

  /**
   * Swap an exercise in the group workout (initiator only)
   * POST /api/v2/lobby/{sessionId}/exercises/swap
   *
   * This endpoint is only available after the group has voted "customize".
   * The swap is broadcast to all members in real-time via WebSocket.
   */
  public async swapExercise(
    sessionId: string,
    data: {
      slot_index: number;
      new_exercise: {
        exercise_id: number;
        exercise_name: string;
        difficulty_level?: number;
        target_muscle_group?: string;
        default_duration_seconds?: number;
        estimated_calories_burned?: number;
        equipment_needed?: string;
        exercise_category?: string;
      };
    }
  ): Promise<{
    status: string;
    message: string;
    data?: {
      slot_index: number;
      old_exercise: any;
      new_exercise: any;
      updated_exercises: any[];
    };
  }> {
    try {
      console.log('[SOCIAL V2] Swapping exercise:', {
        sessionId,
        slotIndex: data.slot_index,
        newExercise: data.new_exercise.exercise_name,
      });

      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/exercises/swap`,
        data
      );

      console.log('[SOCIAL V2] Exercise swapped successfully');
      return response.data;
    } catch (error) {
      // Log as info, not error - caller will verify success via WebSocket fallback
      console.log('[SOCIAL V2] Swap HTTP failed (caller will verify via WebSocket)');
      throw new Error((error as any).message || 'Failed to swap exercise');
    }
  }

  /**
   * Reorder exercises in the workout during group customization
   * Only the designated customizer can reorder exercises.
   */
  public async reorderExercises(
    sessionId: string,
    newOrder: number[]
  ): Promise<{
    status: string;
    message: string;
    data?: {
      updated_exercises: any[];
    };
  }> {
    try {
      console.log('[SOCIAL V2] Reordering exercises:', {
        sessionId,
        newOrder,
      });

      const response = await apiClient.post(
        'social',
        `/api/v2/lobby/${sessionId}/exercises/reorder`,
        { new_order: newOrder }
      );

      console.log('[SOCIAL V2] Exercises reordered successfully');
      return response.data;
    } catch (error) {
      console.log('[SOCIAL V2] Reorder HTTP failed (caller will verify via WebSocket)');
      throw new Error((error as any).message || 'Failed to reorder exercises');
    }
  }
}

export const socialService = new SocialService();
