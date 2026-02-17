import { apiClient } from '../api/client';
import { API_CONFIG } from '../../config/api.config';

export interface MediaUploadResponse {
  success: boolean;
  message: string;
  data: {
    media_file_id: number;
    file_name: string;
    file_path: string;
    url: string;
  };
}

export class MediaService {
  /**
   * Build the full URL for a media file given its relative path.
   * The relative path is stored in the auth service's profile_picture column.
   */
  public getFullMediaUrl(relativePath: string): string {
    if (!relativePath) return '';

    // If it's already a full URL, return as-is
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }

    return `${API_CONFIG.MEDIA_SERVICE_URL}${relativePath}`;
  }

  /**
   * Upload a profile picture to the media service.
   * Returns the response containing the relative URL to store in auth service.
   */
  public async uploadProfilePicture(imageUri: string): Promise<MediaUploadResponse> {
    const formData = new FormData();

    const uriParts = imageUri.split('.');
    const fileType = uriParts[uriParts.length - 1] || 'jpg';

    formData.append('file', {
      uri: imageUri,
      name: `profile_${Date.now()}.${fileType}`,
      type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
    } as any);

    const response = await apiClient.post<MediaUploadResponse>(
      'media',
      '/api/media/profile-picture',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      }
    );

    return response.data;
  }
}

export const mediaService = new MediaService();
