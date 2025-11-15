import { apiClient } from './api/client';

interface AgoraTokenResponse {
  token: string;
  channel_name: string;
  uid: number;
  app_id: string;
  expires_at: string;
}

export const agoraService = {
  /**
   * Get Agora token for joining video call
   */
  async getToken(sessionId: string, userId: number, role: 'publisher' | 'subscriber' = 'publisher'): Promise<AgoraTokenResponse> {
    try {
      console.log('📹 [AGORA] Requesting token for session:', sessionId);

      const response = await apiClient.post('social', '/api/agora/token', {
        session_id: sessionId,
        user_id: userId,
        role,
      });

      console.log('✅ [AGORA] Token received');
      return response.data.data;
    } catch (error: any) {
      console.error('❌ [AGORA] Failed to get token:', error);
      throw error;
    }
  },

  /**
   * Revoke token when leaving video call
   */
  async revokeToken(sessionId: string, userId: number): Promise<void> {
    try {
      console.log('📹 [AGORA] Revoking token for session:', sessionId);

      await apiClient.delete('social', '/api/agora/token', {
        data: {
          session_id: sessionId,
          user_id: userId,
        },
      });

      console.log('✅ [AGORA] Token revoked');
    } catch (error: any) {
      console.error('❌ [AGORA] Failed to revoke token:', error);
      throw error;
    }
  },

  /**
   * Update media status (camera/mic on/off)
   */
  async updateMediaStatus(sessionId: string, userId: number, videoEnabled: boolean, audioEnabled: boolean): Promise<void> {
    try {
      await apiClient.patch('social', '/api/agora/media-status', {
        session_id: sessionId,
        user_id: userId,
        video_enabled: videoEnabled,
        audio_enabled: audioEnabled,
      });

      console.log('✅ [AGORA] Media status updated:', { videoEnabled, audioEnabled });
    } catch (error: any) {
      console.error('❌ [AGORA] Failed to update media status:', error);
    }
  },

  /**
   * Get channel participants
   */
  async getChannelInfo(sessionId: string): Promise<any> {
    try {
      const response = await apiClient.get('social', `/api/agora/channel/${sessionId}`);
      return response.data.data;
    } catch (error: any) {
      console.error('❌ [AGORA] Failed to get channel info:', error);
      throw error;
    }
  },
};
