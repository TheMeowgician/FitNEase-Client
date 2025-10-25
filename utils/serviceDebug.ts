// Service debugging utilities for development
import { apiClient } from '../services/api/client';
import { API_CONFIG } from '../config/api.config';

export interface ServiceStatus {
  serviceName: string;
  url: string;
  isReachable: boolean;
  responseTime?: number;
  error?: string;
}

export const checkServiceConnectivity = async (serviceName: string): Promise<ServiceStatus> => {
  const startTime = Date.now();
  const serviceURL = getServiceURL(serviceName);

  try {
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 5000);
    });

    // Try health endpoint first (use /api/health for all services)
    const fetchPromise = fetch(`${serviceURL}/api/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    let response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

    // If health endpoint fails with 404, try root endpoint
    if (response.status === 404) {
      const rootFetchPromise = fetch(serviceURL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      const rootTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 5000);
      });

      response = await Promise.race([rootFetchPromise, rootTimeoutPromise]) as Response;
    }

    const responseTime = Date.now() - startTime;

    return {
      serviceName,
      url: serviceURL,
      isReachable: response.ok || response.status === 404, // 404 means service is up, just no route
      responseTime,
    };
  } catch (error) {
    return {
      serviceName,
      url: serviceURL,
      isReachable: false,
      responseTime: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
};

export const checkAllServices = async (): Promise<ServiceStatus[]> => {
  const services = ['auth', 'content', 'tracking', 'planning', 'social', 'ml', 'engagement', 'communications', 'media', 'operations'];

  const checks = services.map(service => checkServiceConnectivity(service));
  return Promise.all(checks);
};

export const getServiceURL = (serviceName: string): string => {
  const urls: Record<string, string> = {
    auth: API_CONFIG.AUTH_SERVICE_URL,
    content: API_CONFIG.CONTENT_SERVICE_URL,
    tracking: API_CONFIG.TRACKING_SERVICE_URL,
    planning: API_CONFIG.PLANNING_SERVICE_URL,
    social: API_CONFIG.SOCIAL_SERVICE_URL,
    ml: API_CONFIG.ML_SERVICE_URL,
    engagement: API_CONFIG.ENGAGEMENT_SERVICE_URL,
    communications: API_CONFIG.COMMS_SERVICE_URL,
    media: API_CONFIG.MEDIA_SERVICE_URL,
    operations: API_CONFIG.OPERATIONS_SERVICE_URL,
  };

  return urls[serviceName] || API_CONFIG.BASE_URL;
};

export const logServiceStatus = async () => {
  console.log('🔍 Checking FitNEase microservices connectivity...');

  const statuses = await checkAllServices();

  statuses.forEach(status => {
    const icon = status.isReachable ? '✅' : '❌';
    const timeStr = status.responseTime ? `(${status.responseTime}ms)` : '';
    const errorStr = status.error ? ` - ${status.error}` : '';

    console.log(`${icon} ${status.serviceName.toUpperCase()}: ${status.url} ${timeStr}${errorStr}`);
  });

  const reachableCount = statuses.filter(s => s.isReachable).length;
  console.log(`\n📊 Services Status: ${reachableCount}/${statuses.length} reachable`);

  if (reachableCount === 0) {
    console.log('\n🚨 No services are reachable. Please ensure your backend services are running.');
    console.log('\nTo start the Laravel auth service:');
    console.log('cd [your-auth-service-directory]');
    console.log('php artisan serve --port=8000');
  }

  return statuses;
};

// Development helper to test registration without backend
export const createMockRegistrationResponse = (email: string) => {
  return {
    user: {
      id: 'mock-user-id',
      email: email,
      username: email.split('@')[0],
      firstName: 'Test',
      lastName: 'User',
      isEmailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    tokens: {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    },
    message: 'Registration successful (mock)',
    requiresEmailVerification: true,
  };
};

export default {
  checkServiceConnectivity,
  checkAllServices,
  logServiceStatus,
  getServiceURL,
  createMockRegistrationResponse,
};