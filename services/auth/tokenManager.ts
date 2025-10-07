import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenMetadata {
  expiresAt?: number;
  userId?: string;
  lastRefresh?: number;
}

export class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'accessToken';
  private static readonly REFRESH_TOKEN_KEY = 'refreshToken';
  private static readonly TOKEN_METADATA_KEY = 'tokenMetadata';

  public async setTokens(tokens: TokenPair, metadata?: TokenMetadata): Promise<void> {
    try {
      const storagePromises: Promise<void>[] = [];

      if (Platform.OS === 'web') {
        storagePromises.push(AsyncStorage.setItem(TokenManager.ACCESS_TOKEN_KEY, tokens.accessToken));
        storagePromises.push(AsyncStorage.setItem(TokenManager.REFRESH_TOKEN_KEY, tokens.refreshToken));
      } else {
        storagePromises.push(SecureStore.setItemAsync(TokenManager.ACCESS_TOKEN_KEY, tokens.accessToken));
        storagePromises.push(SecureStore.setItemAsync(TokenManager.REFRESH_TOKEN_KEY, tokens.refreshToken));
      }

      if (metadata) {
        storagePromises.push(AsyncStorage.setItem(
          TokenManager.TOKEN_METADATA_KEY,
          JSON.stringify({
            ...metadata,
            lastRefresh: Date.now()
          })
        ));
      }

      await Promise.all(storagePromises);
    } catch (error) {
      console.error('Error setting tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  public async getTokens(): Promise<TokenPair | null> {
    try {
      let accessToken: string | null;
      let refreshToken: string | null;

      if (Platform.OS === 'web') {
        [accessToken, refreshToken] = await Promise.all([
          AsyncStorage.getItem(TokenManager.ACCESS_TOKEN_KEY),
          AsyncStorage.getItem(TokenManager.REFRESH_TOKEN_KEY)
        ]);
      } else {
        [accessToken, refreshToken] = await Promise.all([
          SecureStore.getItemAsync(TokenManager.ACCESS_TOKEN_KEY),
          SecureStore.getItemAsync(TokenManager.REFRESH_TOKEN_KEY)
        ]);
      }

      if (accessToken && refreshToken) {
        return { accessToken, refreshToken };
      }

      return null;
    } catch (error) {
      console.error('Error getting tokens:', error);
      return null;
    }
  }

  public async getAccessToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(TokenManager.ACCESS_TOKEN_KEY);
      } else {
        return await SecureStore.getItemAsync(TokenManager.ACCESS_TOKEN_KEY);
      }
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  public async getRefreshToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(TokenManager.REFRESH_TOKEN_KEY);
      } else {
        return await SecureStore.getItemAsync(TokenManager.REFRESH_TOKEN_KEY);
      }
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  public async getTokenMetadata(): Promise<TokenMetadata | null> {
    try {
      const metadataString = await AsyncStorage.getItem(TokenManager.TOKEN_METADATA_KEY);
      if (metadataString) {
        return JSON.parse(metadataString);
      }
      return null;
    } catch (error) {
      console.error('Error getting token metadata:', error);
      return null;
    }
  }

  public async updateTokenMetadata(metadata: Partial<TokenMetadata>): Promise<void> {
    try {
      const existingMetadata = await this.getTokenMetadata() || {};
      const updatedMetadata = {
        ...existingMetadata,
        ...metadata,
        lastRefresh: Date.now()
      };

      await AsyncStorage.setItem(
        TokenManager.TOKEN_METADATA_KEY,
        JSON.stringify(updatedMetadata)
      );
    } catch (error) {
      console.error('Error updating token metadata:', error);
      throw new Error('Failed to update token metadata');
    }
  }

  public async clearTokens(): Promise<void> {
    try {
      const clearPromises: Promise<void>[] = [];

      if (Platform.OS === 'web') {
        clearPromises.push(AsyncStorage.removeItem(TokenManager.ACCESS_TOKEN_KEY));
        clearPromises.push(AsyncStorage.removeItem(TokenManager.REFRESH_TOKEN_KEY));
      } else {
        clearPromises.push(SecureStore.deleteItemAsync(TokenManager.ACCESS_TOKEN_KEY));
        clearPromises.push(SecureStore.deleteItemAsync(TokenManager.REFRESH_TOKEN_KEY));
      }

      clearPromises.push(AsyncStorage.removeItem(TokenManager.TOKEN_METADATA_KEY));

      await Promise.all(clearPromises);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  public async hasValidTokens(): Promise<boolean> {
    try {
      const tokens = await this.getTokens();
      if (!tokens) {
        return false;
      }

      const metadata = await this.getTokenMetadata();
      if (metadata?.expiresAt && metadata.expiresAt < Date.now()) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking token validity:', error);
      return false;
    }
  }

  public async isTokenExpired(): Promise<boolean> {
    try {
      const metadata = await this.getTokenMetadata();
      if (!metadata?.expiresAt) {
        return false;
      }

      return metadata.expiresAt < Date.now();
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true;
    }
  }

  public async getTokenExpirationTime(): Promise<number | null> {
    try {
      const metadata = await this.getTokenMetadata();
      return metadata?.expiresAt || null;
    } catch (error) {
      console.error('Error getting token expiration time:', error);
      return null;
    }
  }

  public async getTimeUntilExpiration(): Promise<number | null> {
    try {
      const expiresAt = await this.getTokenExpirationTime();
      if (!expiresAt) {
        return null;
      }

      const timeUntilExpiration = expiresAt - Date.now();
      return Math.max(0, timeUntilExpiration);
    } catch (error) {
      console.error('Error calculating time until expiration:', error);
      return null;
    }
  }

  public async shouldRefreshToken(thresholdMinutes: number = 5): Promise<boolean> {
    try {
      const timeUntilExpiration = await this.getTimeUntilExpiration();
      if (!timeUntilExpiration) {
        return false;
      }

      const thresholdMs = thresholdMinutes * 60 * 1000;
      return timeUntilExpiration < thresholdMs;
    } catch (error) {
      console.error('Error checking if token should be refreshed:', error);
      return true;
    }
  }

  public parseTokenPayload(token: string): any {
    try {
      // Laravel Sanctum tokens are plain tokens, not JWT tokens
      // They have format like "1|token_string" and cannot be parsed like JWT
      // For Sanctum tokens, we'll extract basic info from the token structure

      if (!token || typeof token !== 'string') {
        return null;
      }

      // Check if it's a JWT token (has 3 parts separated by dots)
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        // This is a JWT token, parse normally
        const base64Url = tokenParts[1];
        if (!base64Url) return null;

        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );

        return JSON.parse(jsonPayload);
      } else {
        // This is likely a Laravel Sanctum token (format: "id|hash")
        // Return basic info we can extract
        const parts = token.split('|');
        return {
          tokenId: parts[0] || null,
          type: 'sanctum',
          raw: token
        };
      }
    } catch (error) {
      console.error('Error parsing token payload:', error);
      return null;
    }
  }

  public async extractTokenInfo(token?: string): Promise<TokenMetadata | null> {
    try {
      const accessToken = token || await this.getAccessToken();
      if (!accessToken) {
        return null;
      }

      const payload = this.parseTokenPayload(accessToken);
      if (!payload) {
        return null;
      }

      return {
        expiresAt: payload.exp ? payload.exp * 1000 : undefined,
        userId: payload.sub || payload.userId,
        lastRefresh: Date.now()
      };
    } catch (error) {
      console.error('Error extracting token info:', error);
      return null;
    }
  }

  public async updateTokensWithAutoMetadata(tokens: TokenPair): Promise<void> {
    try {
      const metadata = await this.extractTokenInfo(tokens.accessToken);
      await this.setTokens(tokens, metadata || undefined);
    } catch (error) {
      console.error('Error updating tokens with auto metadata:', error);
      await this.setTokens(tokens);
    }
  }

  public async debugTokenInfo(): Promise<any> {
    try {
      const tokens = await this.getTokens();
      const metadata = await this.getTokenMetadata();
      const isExpired = await this.isTokenExpired();
      const timeUntilExpiration = await this.getTimeUntilExpiration();
      const shouldRefresh = await this.shouldRefreshToken();

      return {
        hasTokens: !!tokens,
        hasAccessToken: !!tokens?.accessToken,
        hasRefreshToken: !!tokens?.refreshToken,
        metadata,
        isExpired,
        timeUntilExpiration,
        shouldRefresh,
        tokenInfo: tokens?.accessToken ? this.parseTokenPayload(tokens.accessToken) : null
      };
    } catch (error) {
      console.error('Error getting debug token info:', error);
      return { error: (error as any).message };
    }
  }
}

export const tokenManager = new TokenManager();