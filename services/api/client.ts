import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_CONFIG } from '../../config/api.config';

export interface ApiResponse<T = any> {
  data: T;
  message: string;
  success: boolean;
  status: number;
}

export interface ErrorResponse {
  message: string;
  error: string;
  status: number;
  success: false;
}

export interface TokenPair {
  accessToken: string;
  refreshToken?: string; // Optional for Sanctum compatibility
}

export interface ServiceConfig {
  baseURL: string;
  service: string;
}

export interface APIClientConfig {
  auth: ServiceConfig;
  content: ServiceConfig;
  tracking: ServiceConfig;
  planning: ServiceConfig;
  social: ServiceConfig;
  ml: ServiceConfig;
  engagement: ServiceConfig;
  communications: ServiceConfig;
  media: ServiceConfig;
  operations: ServiceConfig;
}

export class APIClient {
  private configs: APIClientConfig;
  private clients: Map<string, AxiosInstance> = new Map();
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;
  private inFlightRequests = new Map<string, Promise<ApiResponse<any>>>();

  // Rate limit retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 second

  constructor(configs: APIClientConfig) {
    this.configs = configs;
    this.initializeClients();
  }

  /**
   * Delay execution with exponential backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeClients(): void {
    Object.entries(this.configs).forEach(([service, config]) => {
      console.log(`🔧 [API CLIENT] Initializing ${service} service with baseURL:`, config.baseURL);

      const client = axios.create({
        baseURL: config.baseURL,
        timeout: 15000, // 15 seconds for mobile networks
        headers: {
          'Content-Type': 'application/json',
        },
      });

      this.setupInterceptors(client, service);
      this.clients.set(service, client);
    });
  }

  private setupInterceptors(client: AxiosInstance, serviceName: string): void {
    // Request interceptor
    client.interceptors.request.use(
      async (config) => {
        console.log(`🔐 [${serviceName}] Request interceptor called:`, {
          url: config.url,
          method: config.method,
          hasData: !!config.data,
          data: config.data
        });

        const token = await this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log(`🔑 [${serviceName}] Adding token to request:`, {
            url: config.url,
            tokenPrefix: token.substring(0, 15) + '...',
            hasToken: !!token
          });
        } else {
          console.warn(`⚠️ [${serviceName}] No token available for request:`, config.url);
        }

        console.log(`✅ [${serviceName}] Request interceptor complete, returning config`);
        return config;
      },
      (error) => {
        console.error(`❌ [${serviceName}] Request interceptor ERROR:`, {
          error,
          message: error.message,
          stack: error.stack
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean; _retryCount?: number; _networkRetryCount?: number };

        // Check if this is an auth endpoint that should NOT trigger token refresh
        const authExcludedEndpoints = [
          '/api/auth/login',
          '/api/auth/register',
          '/api/auth/refresh',
          '/api/auth/verify-email',
          '/api/auth/verify-code',
          '/api/auth/forgot-password',
          '/api/auth/reset-password',
          '/api/auth/resend-verification'
        ];

        const isAuthExcluded = authExcludedEndpoints.some(endpoint =>
          originalRequest.url?.includes(endpoint)
        );

        // Handle network-level errors with retry (slow/no internet)
        const isNetworkError = !error.response && (
          error.code === 'ECONNABORTED' ||
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ERR_NETWORK' ||
          error.message === 'Network Error'
        );

        if (isNetworkError) {
          const networkRetryCount = originalRequest._networkRetryCount || 0;
          if (networkRetryCount < 2) {
            originalRequest._networkRetryCount = networkRetryCount + 1;
            const delayMs = networkRetryCount === 0 ? 1000 : 3000;
            console.log(`🔄 [${serviceName}] Network error (${error.code || error.message}), retrying in ${delayMs}ms (attempt ${networkRetryCount + 1}/2)`);
            await this.delay(delayMs);
            return client(originalRequest);
          }
          console.error(`❌ [${serviceName}] Network error retry exhausted after 2 attempts`);
        }

        // Handle rate limiting (429) with exponential backoff retry
        if (error.response?.status === 429) {
          const retryCount = originalRequest._retryCount || 0;

          if (retryCount < this.MAX_RETRIES) {
            originalRequest._retryCount = retryCount + 1;

            // Get retry-after header or calculate exponential backoff
            const retryAfter = error.response.headers['retry-after'];
            const delayMs = retryAfter
              ? parseInt(retryAfter) * 1000
              : this.INITIAL_RETRY_DELAY * Math.pow(2, retryCount);

            console.log(`⏳ [${serviceName}] Rate limited (429), retrying in ${delayMs}ms (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);

            await this.delay(delayMs);
            return client(originalRequest);
          } else {
            console.error(`❌ [${serviceName}] Rate limit retry exhausted after ${this.MAX_RETRIES} attempts`);
          }
        }

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthExcluded) {
          console.log(`🔄 [${serviceName}] Got 401, attempting token refresh...`);
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshToken();
            if (newToken && originalRequest.headers) {
              console.log(`✅ [${serviceName}] Token refreshed, retrying original request`);
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return client(originalRequest);
            }
          } catch (refreshError: any) {
            console.error(`❌ [${serviceName}] Token refresh failed, clearing tokens`);
            console.log('💡 This usually means your token has completely expired.');
            console.log('💡 Please log out and log in again to get a fresh token.');
            await this.clearTokens();
            throw new Error('Session expired. Please log in again.');
          }
        }

        // For auth excluded endpoints, just pass through the original error
        if (isAuthExcluded && error.response?.status === 401) {
          console.log(`🔐 [${serviceName}] Auth endpoint returned 401 (likely invalid credentials)`);
        }

        throw this.handleError(error, serviceName);
      }
    );
  }

  private handleError(error: AxiosError, serviceName: string): Error {
    if (error.response) {
      const errorData = error.response.data as any;
      const message = errorData?.message || errorData?.error || `${serviceName} service error`;
      return new Error(`[${serviceName.toUpperCase()}] ${message}`);
    } else if (error.request) {
      return new Error(`[${serviceName.toUpperCase()}] Network error - unable to reach service`);
    } else {
      return new Error(`[${serviceName.toUpperCase()}] Request setup error: ${(error as any).message}`);
    }
  }

  private async getAccessToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem('accessToken');
      } else {
        return await SecureStore.getItemAsync('accessToken');
      }
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  private async getRefreshToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem('refreshToken');
      } else {
        return await SecureStore.getItemAsync('refreshToken');
      }
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  private async setTokens(tokens: TokenPair): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem('accessToken', tokens.accessToken);
        if (tokens.refreshToken) {
          await AsyncStorage.setItem('refreshToken', tokens.refreshToken);
        }
      } else {
        await SecureStore.setItemAsync('accessToken', tokens.accessToken);
        if (tokens.refreshToken) {
          await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);
        }
      }
    } catch (error) {
      console.error('Error setting tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  private async clearTokens(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
      } else {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
      }
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  private async refreshToken(): Promise<string | null> {
    if (this.isRefreshing) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string | null> {
    try {
      // Get current access token (Sanctum uses it to refresh)
      const currentToken = await this.getAccessToken();

      console.log('🔄 Token refresh starting...', {
        hasToken: !!currentToken,
        tokenPrefix: currentToken ? currentToken.substring(0, 15) + '...' : 'none'
      });

      if (!currentToken) {
        throw new Error('No access token available for refresh');
      }

      // Create a fresh axios instance WITHOUT interceptors to avoid infinite loops
      const axios = require('axios').default;
      const authServiceUrl = this.configs.auth.baseURL;

      console.log('🔄 Calling refresh endpoint:', `${authServiceUrl}/api/auth/refresh`);

      // Direct axios call without interceptors
      const response = await axios.post(
        `${authServiceUrl}/api/auth/refresh`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log('📡 Refresh response received:', {
        status: response.status,
        hasData: !!response.data,
        hasToken: !!(response.data.token || response.data.data?.token)
      });

      // Extract new token from response (Sanctum returns single token)
      const newToken = response.data.token || response.data.data?.token;
      if (!newToken) {
        console.error('❌ No token found in response:', response.data);
        throw new Error('No token in refresh response');
      }

      console.log('✅ Token refresh successful, storing new token');

      // Store new token (same as both access and refresh for Sanctum compatibility)
      await this.setTokens({ accessToken: newToken, refreshToken: newToken });

      return newToken;
    } catch (error: any) {
      console.error('❌ Token refresh failed:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        isAxiosError: !!error.isAxiosError,
        code: error.code
      });
      throw error;
    }
  }

  public async login(tokens: TokenPair): Promise<void> {
    await this.setTokens(tokens);
  }

  public async logout(): Promise<void> {
    await this.clearTokens();
  }

  public getClient(service: keyof APIClientConfig): AxiosInstance {
    const client = this.clients.get(service);
    if (!client) {
      throw new Error(`Client for service '${service}' not found`);
    }
    return client;
  }

  public async request<T = any>(
    service: keyof APIClientConfig,
    config: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const client = this.getClient(service);

    // Log full request details for debugging
    console.log(`🔍 [API REQUEST DETAILS] Service: ${service}`, {
      baseURL: this.configs[service].baseURL,
      url: config.url,
      method: config.method,
      fullURL: `${this.configs[service].baseURL}${config.url}`,
      timeout: config.timeout || 30000,
      headers: config.headers,
      data: config.data
    });

    try {
      console.log(`🚀 [${service}] About to call axios client...`);
      try {
        console.log(`🔍 [${service}] Config being passed to axios:`, {
          url: config.url,
          method: config.method,
          data: config.data,
          dataType: typeof config.data,
          dataStringified: config.data ? JSON.stringify(config.data) : 'null'
        });
      } catch (jsonError: any) {
        console.error(`❌ [${service}] Failed to stringify data:`, {
          error: jsonError.message,
          dataKeys: config.data ? Object.keys(config.data) : 'null'
        });
      }

      console.log(`✈️ [${service}] Calling client(config) now...`);
      const response: AxiosResponse<any> = await client(config);
      console.log(`📨 [${service}] Axios client returned response`);

      console.log(`📡 Raw axios response for ${service}:`, {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers
      });

      // Laravel typically returns direct JSON data, not wrapped in ApiResponse
      // So we need to adapt to that format
      return {
        data: response.data,
        message: response.data?.message || 'Success',
        success: response.status >= 200 && response.status < 300,
        status: response.status
      } as ApiResponse<T>;
    } catch (error) {
      const axiosError = error as any;
      const errorMessage = axiosError?.message || '';
      const isServiceUnavailable = errorMessage.includes('Network error') ||
                                   errorMessage.includes('service error') ||
                                   errorMessage.includes('could not be found');

      // Check if this is a logout request (which can fail gracefully)
      const isLogoutRequest = config.url?.includes('/logout') || config.url?.includes('/auth/logout');
      const isLogoutError = (errorMessage.includes('currentAccessToken') ||
                           (errorMessage.includes('null') && errorMessage.includes('token'))) &&
                           isLogoutRequest;

      // Check if this is a "graceful" error that will be handled by the calling service
      // These errors are expected and don't indicate a real problem
      const isGracefulError = errorMessage.includes('You are not in this lobby') ||
                             errorMessage.includes('not in this lobby') ||
                             errorMessage.includes('already left') ||
                             errorMessage.includes('no longer valid') ||
                             errorMessage.includes('Invitation is no longer valid');

      // Check if this is a swap endpoint (has WebSocket fallback, caller will verify)
      const isSwapEndpoint = config.url?.includes('/exercises/swap');

      // For non-critical services (ML, tracking, engagement, planning), log as warning instead of error
      const isNonCriticalService = service === 'ml' || service === 'tracking' || service === 'engagement' || service === 'planning' || service === 'communications';

      if (isLogoutError) {
        // Logout errors are expected when session is already expired
        console.log(`ℹ️ Logout request completed (session may have been already cleared)`, {
          url: config.url
        });
        // Return success response for logout even if backend failed
        return {
          data: {} as T,
          message: 'Logout completed',
          success: true,
          status: 200
        } as ApiResponse<T>;
      } else if (isGracefulError) {
        // Log graceful errors as info instead of errors to avoid confusion
        // These will be handled appropriately by the calling service
        console.log(`ℹ️ [${service}] Expected error (will be handled gracefully):`, {
          message: errorMessage,
          url: config.url
        });
        throw error;
      } else if (isSwapEndpoint) {
        // Swap endpoints have WebSocket fallback - caller will verify success via WebSocket
        // Log as info to avoid confusing ERROR logs when swap actually succeeds
        console.log(`ℹ️ [${service}] Swap request HTTP failed (will verify via WebSocket):`, {
          url: config.url
        });
        throw error;
      } else if (isNonCriticalService) {
        // Non-critical services: brief warning only (callers handle failures gracefully)
        console.warn(`⚠️ Non-critical service ${service} error (non-blocking):`, {
          message: errorMessage,
          url: config.url
        });
        throw error;
      } else {
        // Log detailed error for critical services or unexpected errors
        console.error(`❌ [${service}] CAUGHT ERROR in request method:`, {
          error,
          errorType: error?.constructor?.name,
          errorMessage: (error as any)?.message,
          errorStack: (error as any)?.stack,
          isAxiosError: (error as any)?.isAxiosError,
          hasResponse: !!(error as any)?.response,
          hasRequest: !!(error as any)?.request,
          hasConfig: !!(error as any)?.config
        });

        console.error(`❌ [API REQUEST ERROR] Service: ${service}`, {
          message: errorMessage,
          code: axiosError?.code,
          url: config.url,
          fullURL: `${this.configs[service].baseURL}${config.url}`,
          timeout: config.timeout,
          hasResponse: !!axiosError?.response,
          hasRequest: !!axiosError?.request,
          responseStatus: axiosError?.response?.status,
          responseData: axiosError?.response?.data
        });

        console.error(`❌ API request failed for ${service}:`, {
          config,
          error: error,
          message: errorMessage,
          response: axiosError?.response?.data
        });
        throw error;
      }
    }
  }

  public async get<T = any>(
    service: keyof APIClientConfig,
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const key = `${service}:${url}:${JSON.stringify(config?.params || {})}`;

    if (this.inFlightRequests.has(key)) {
      console.log(`🔁 [GET DEDUP] Reusing in-flight request: ${key}`);
      return this.inFlightRequests.get(key)! as Promise<ApiResponse<T>>;
    }

    console.log(`🌐 [GET REQUEST] Service: ${service}, BaseURL: ${this.configs[service].baseURL}, Path: ${url}`);
    const promise = this.request<T>(service, { ...config, method: 'GET', url });
    this.inFlightRequests.set(key, promise);

    try {
      return await promise;
    } finally {
      this.inFlightRequests.delete(key);
    }
  }

  public async post<T = any>(
    service: keyof APIClientConfig,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    console.log(`🔄 POST Request to ${service} service:`, {
      url,
      baseURL: this.configs[service].baseURL,
      fullURL: `${this.configs[service].baseURL}${url}`,
      data
    });

    const response = await this.request<T>(service, { ...config, method: 'POST', url, data });

    console.log(`✅ POST Response from ${service} service:`, {
      url,
      status: response ? 'success' : 'undefined',
      data: response
    });

    return response;
  }

  public async put<T = any>(
    service: keyof APIClientConfig,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(service, { ...config, method: 'PUT', url, data });
  }

  public async patch<T = any>(
    service: keyof APIClientConfig,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(service, { ...config, method: 'PATCH', url, data });
  }

  public async delete<T = any>(
    service: keyof APIClientConfig,
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(service, { ...config, method: 'DELETE', url });
  }

  public updateServiceConfig(service: keyof APIClientConfig, config: ServiceConfig): void {
    this.configs[service] = config;

    const client = axios.create({
      baseURL: config.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors(client, service);
    this.clients.set(service, client);
  }

  public isTokenValid(): Promise<boolean> {
    return new Promise(async (resolve) => {
      const token = await this.getAccessToken();
      resolve(!!token);
    });
  }
}

// Service configurations - now using centralized config
export const DEFAULT_SERVICE_CONFIGS: APIClientConfig = {
  auth: {
    baseURL: API_CONFIG.AUTH_SERVICE_URL,
    service: 'auth'
  },
  content: {
    baseURL: API_CONFIG.CONTENT_SERVICE_URL,
    service: 'content'
  },
  tracking: {
    baseURL: API_CONFIG.TRACKING_SERVICE_URL,
    service: 'tracking'
  },
  planning: {
    baseURL: API_CONFIG.PLANNING_SERVICE_URL,
    service: 'planning'
  },
  social: {
    baseURL: API_CONFIG.SOCIAL_SERVICE_URL,
    service: 'social'
  },
  ml: {
    baseURL: API_CONFIG.ML_SERVICE_URL,
    service: 'ml'
  },
  engagement: {
    baseURL: API_CONFIG.ENGAGEMENT_SERVICE_URL,
    service: 'engagement'
  },
  communications: {
    baseURL: API_CONFIG.COMMS_SERVICE_URL,
    service: 'communications'
  },
  media: {
    baseURL: API_CONFIG.MEDIA_SERVICE_URL,
    service: 'media'
  },
  operations: {
    baseURL: API_CONFIG.OPERATIONS_SERVICE_URL,
    service: 'operations'
  }
};

// Global API client instance
export const apiClient = new APIClient(DEFAULT_SERVICE_CONFIGS);