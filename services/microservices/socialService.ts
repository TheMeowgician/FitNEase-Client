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
  name?: string;
  description?: string;
  type?: 'public' | 'private' | 'invite-only';
  category?: string;
  maxMembers?: number;
  tags?: string[];
  rules?: string[];
  location?: any;
  schedule?: any;
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
      const response = await apiClient.post<Group>('social', '/api/social/groups', request);
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
      const response = await apiClient.get('social', `/api/social/groups?${params}`);

      // Laravel returns data in response.data.data format
      const rawData = response.data.data || response.data;

      // Transform Laravel response to frontend format
      const transformedGroups: Group[] = (rawData.data || []).map((group: any) => ({
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
          totalWorkouts: 0,
          totalMinutes: 0,
          averageWeeklyActivity: 0,
          mostActiveDay: '',
          popularWorkoutTypes: [],
          memberProgress: { improving: 0, maintaining: 0, declining: 0 }
        },
        createdAt: group.created_at,
        updatedAt: group.updated_at
      }));

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
      const response = await apiClient.get('social', `/api/social/groups/${groupId}`);

      // Transform Laravel response to frontend format
      const rawGroup = response.data.data || response.data;

      console.log('🔍 Raw Group Data from Backend:', {
        group_id: rawGroup.group_id,
        group_name: rawGroup.group_name,
        group_code: rawGroup.group_code,
        has_group_code: !!rawGroup.group_code
      });

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
          totalWorkouts: 0,
          totalMinutes: 0,
          averageWeeklyActivity: 0,
          mostActiveDay: '',
          popularWorkoutTypes: [],
          memberProgress: { improving: 0, maintaining: 0, declining: 0 }
        },
        createdAt: rawGroup.created_at,
        updatedAt: rawGroup.updated_at
      };

      return transformedGroup;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to get group');
    }
  }

  public async updateGroup(groupId: string, updates: UpdateGroupRequest): Promise<Group> {
    try {
      const response = await apiClient.put<Group>('social', `/api/social/groups/${groupId}`, updates);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to update group');
    }
  }

  public async deleteGroup(groupId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<{ message: string }>('social', `/api/social/groups/${groupId}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to delete group');
    }
  }

  public async joinGroup(request: JoinGroupRequest): Promise<{ message: string }> {
    try {
      // Backend expects 'group_code', not 'groupId'
      const response = await apiClient.post<{ message: string }>('social', '/api/social/groups/join-with-code', {
        group_code: request.groupId,
        message: request.message
      });
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to join group');
    }
  }

  public async leaveGroup(groupId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<{ message: string }>('social', `/api/social/groups/${groupId}/leave`);
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
      const response = await apiClient.get('social', `/api/social/groups/${groupId}/members?page=${page}&limit=${limit}`);

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
      const response = await apiClient.put<{ message: string }>('social', `/api/social/groups/${groupId}/members/${userId}`, { role });
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to update member role');
    }
  }

  public async removeGroupMember(groupId: string, userId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<{ message: string }>('social', `/api/social/groups/${groupId}/members/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to remove group member');
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
      }>('social', `/social/users/search?${params}`);
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
      const response = await apiClient.post(
        'social',
        `/api/social/groups/${groupId}/initiate-workout`,
        { workout_data: workoutData }
      );
      return response.data.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to initiate group workout');
    }
  }

  // Workout Lobby
  public async updateLobbyStatus(
    sessionId: string,
    status: 'waiting' | 'ready'
  ): Promise<void> {
    try {
      await apiClient.post(
        'social',
        `/api/social/lobby/${sessionId}/status`,
        { status }
      );
    } catch (error) {
      throw new Error((error as any).message || 'Failed to update lobby status');
    }
  }

  public async startWorkout(sessionId: string): Promise<{
    session_id: string;
    start_time: number;
  }> {
    try {
      const response = await apiClient.post(
        'social',
        `/api/social/lobby/${sessionId}/start`,
        {}
      );
      return response.data.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to start workout');
    }
  }

  // Workout Session Control
  public async pauseWorkout(sessionId: string): Promise<{
    session_id: string;
    paused_at: number;
  }> {
    try {
      const response = await apiClient.post(
        'social',
        `/api/social/session/${sessionId}/pause`,
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
        `/api/social/session/${sessionId}/resume`,
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
        `/api/social/session/${sessionId}/stop`,
        {}
      );
      return response.data.data;
    } catch (error) {
      throw new Error((error as any).message || 'Failed to stop workout');
    }
  }
}

export const socialService = new SocialService();