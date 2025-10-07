# FitNEase API Services

This directory contains the complete API service layer for the FitNEase React Native client application. It provides a comprehensive interface to all microservices in the FitNEase platform.

## 🏗️ Architecture

The service layer is built with a modular architecture consisting of:

- **API Client** (`api/client.ts`) - Core HTTP client with automatic token refresh
- **Token Manager** (`auth/tokenManager.ts`) - Secure token storage and management
- **Microservice Clients** (`microservices/`) - Service-specific API clients
- **Unified Interface** (`index.ts`) - Centralized exports and convenience methods

## 📦 Services

### 1. Authentication Service (`authService`)
Handles user authentication, registration, profile management, and preferences.

**Key Features:**
- Login/logout with JWT tokens
- User registration and email verification
- Password reset and change
- Profile and preferences management
- Two-factor authentication
- Session management

### 2. ML Service (`mlService`)
Provides AI-powered recommendations and analytics.

**Key Features:**
- Personalized workout recommendations
- Nutrition suggestions
- Performance analysis and predictions
- Injury risk assessment
- Form feedback and corrections
- Adaptive learning algorithms

### 3. Social Service (`socialService`)
Manages social features, groups, and community interactions.

**Key Features:**
- Friend management and requests
- Group creation and participation
- Workout sharing and comments
- Challenge participation
- Activity feeds
- Workout evaluations and reviews

### 4. Tracking Service (`trackingService`)
Handles workout logging, progress tracking, and goal management.

**Key Features:**
- Workout session tracking
- Progress logging (weight, measurements, etc.)
- BMI tracking and history
- Goal setting and milestone tracking
- Achievement system
- Performance metrics and analytics

## 🚀 Quick Start

### Basic Setup

```typescript
import { authService, trackingService, mlService, socialService } from './services';

// Simple login
const loginResult = await authService.login({
  email: 'user@example.com',
  password: 'password123'
});

// Get workout recommendations
const recommendations = await mlService.getWorkoutRecommendations({
  factors: {
    fitnessLevel: 'intermediate',
    goals: ['muscle-gain']
  }
});
```

### Using Quick Access Helpers

```typescript
import { quick } from './services';

// Simplified API calls
await quick.login('user@example.com', 'password123');
const workouts = await quick.getWorkouts({ type: 'strength' });
const feed = await quick.getFeed();
```

### Service Configuration

```typescript
import { configureServices } from './services';

// Configure for production
configureServices({
  auth: { baseURL: 'https://api.fitnease.com/auth', service: 'auth' },
  ml: { baseURL: 'https://api.fitnease.com/ml', service: 'ml' }
});
```

## 🔒 Authentication & Security

### Token Management
The system automatically handles JWT token storage and refresh:

```typescript
import { authHelpers, tokenManager } from './services';

// Check authentication status
const isLoggedIn = await authHelpers.isLoggedIn();

// Debug token information
const tokenInfo = await tokenManager.debugTokenInfo();

// Manual token refresh
await authHelpers.refreshIfNeeded();
```

### Secure Storage
- **Mobile**: Uses Expo SecureStore for token storage
- **Web**: Falls back to AsyncStorage
- **Auto-refresh**: Tokens are automatically refreshed on 401 responses

## 📱 React Native Integration

### Using with Components

```typescript
import React, { useEffect, useState } from 'react';
import { trackingService } from '../services';

export const WorkoutList = () => {
  const [workouts, setWorkouts] = useState([]);

  useEffect(() => {
    const loadWorkouts = async () => {
      try {
        const result = await trackingService.getWorkouts({
          type: 'strength',
          difficulty: 'intermediate'
        });
        setWorkouts(result.workouts);
      } catch (error) {
        console.error('Failed to load workouts:', error);
      }
    };

    loadWorkouts();
  }, []);

  return (
    // Your component JSX
  );
};
```

### Error Handling

```typescript
import { authHelpers } from '../services';

const handleApiCall = async () => {
  try {
    const result = await trackingService.getWorkouts();
    return result;
  } catch (error) {
    if (error.message.includes('401')) {
      // Redirect to login
      await authHelpers.logout();
      // Navigate to login screen
    } else if (error.message.includes('Network')) {
      // Show offline message
      showOfflineMessage();
    } else {
      // Show generic error
      showErrorMessage(error.message);
    }
  }
};
```

## 🔄 Data Flow Examples

### Complete Workout Flow

```typescript
// 1. Get recommendations
const recommendations = await mlService.getWorkoutRecommendations();

// 2. Start workout session
const session = await trackingService.startWorkout({
  workoutId: recommendations[0].id
});

// 3. Track progress during workout
await trackingService.updateSession(session.id, {
  exercises: [/* exercise data */],
  mood: 'good',
  energy: 'high'
});

// 4. Complete workout
await trackingService.completeWorkout(session.id, {
  actualCaloriesBurned: 350,
  overallRating: 5
});

// 5. Share with friends
await socialService.shareWorkout({
  workoutId: recommendations[0].id,
  description: 'Great workout!',
  visibility: 'friends'
});
```

### Progress Tracking Flow

```typescript
// Log daily measurements
await trackingService.logProgress({
  type: 'weight',
  value: 75.5,
  unit: 'kg'
});

// Update goals
const goals = await trackingService.getGoals({ isActive: true });
await trackingService.updateGoalProgress(goals.goals[0].id, 75.5);

// Get insights
const metrics = await trackingService.getPerformanceMetrics('month');
const insights = await mlService.getPersonalizedInsights();
```

## 🛠️ Development Tools

### Service Health Check

```typescript
import { checkServiceHealth, dev } from './services';

// Check all services
const health = await checkServiceHealth();
console.log('Service health:', health);

// Debug authentication
const authStatus = await dev.getAuthStatus();
console.log('Auth status:', authStatus);
```

### Running Examples

```typescript
import { examples, runAllExamples } from './services/examples/serviceUsage';

// Run specific example
await examples.authentication();

// Run all examples (for testing)
await runAllExamples();
```

## 📊 TypeScript Support

All services are fully typed with comprehensive TypeScript interfaces:

```typescript
import type {
  User,
  WorkoutRecommendation,
  WorkoutSession,
  Group,
  Challenge,
  ProgressEntry
} from './services';

// Type-safe API calls
const user: User = await authService.getCurrentUser();
const recommendations: WorkoutRecommendation[] = await mlService.getWorkoutRecommendations();
```

## 🔧 Configuration Options

### Service Endpoints

Default configuration (development):
```typescript
const DEFAULT_SERVICE_CONFIGS = {
  auth: { baseURL: 'http://localhost:3001', service: 'auth' },
  content: { baseURL: 'http://localhost:3002', service: 'content' },
  tracking: { baseURL: 'http://localhost:3003', service: 'tracking' },
  planning: { baseURL: 'http://localhost:3004', service: 'planning' },
  social: { baseURL: 'http://localhost:3005', service: 'social' },
  ml: { baseURL: 'http://localhost:3006', service: 'ml' },
  engagement: { baseURL: 'http://localhost:3007', service: 'engagement' },
  communications: { baseURL: 'http://localhost:3008', service: 'communications' },
  media: { baseURL: 'http://localhost:3009', service: 'media' },
  operations: { baseURL: 'http://localhost:3010', service: 'operations' }
};
```

### Timeout and Retry Options

The API client includes:
- 30-second request timeout
- Automatic token refresh on 401 responses
- Comprehensive error handling
- Request/response interceptors

## 🧪 Testing

### Unit Testing Services

```typescript
import { authService } from '../services';

// Mock the API client for testing
jest.mock('../services/api/client');

describe('AuthService', () => {
  it('should login successfully', async () => {
    const result = await authService.login({
      email: 'test@example.com',
      password: 'password'
    });
    expect(result.user).toBeDefined();
  });
});
```

## 📚 API Reference

For detailed API documentation, see:
- [Authentication API](./microservices/authService.ts)
- [ML API](./microservices/mlService.ts)
- [Social API](./microservices/socialService.ts)
- [Tracking API](./microservices/trackingService.ts)

## 🐛 Troubleshooting

### Common Issues

1. **Token Refresh Failures**
   ```typescript
   // Clear tokens and re-login
   await tokenManager.clearTokens();
   await authService.login(credentials);
   ```

2. **Network Errors**
   ```typescript
   // Check service health
   const health = await checkServiceHealth();
   ```

3. **TypeScript Errors**
   - Ensure all dependencies are installed
   - Check import paths are correct
   - Verify TypeScript configuration

### Debug Information

```typescript
import { dev } from './services';

// Get comprehensive debug info
const authStatus = await dev.getAuthStatus();
const tokenInfo = await dev.getTokenInfo();
const health = await dev.checkHealth();

console.log({ authStatus, tokenInfo, health });
```

## 📋 Dependencies

Required packages:
- `axios` - HTTP client
- `expo-secure-store` - Secure token storage
- `@react-native-async-storage/async-storage` - General storage

## 🔄 Updates and Maintenance

The services are designed to be:
- **Modular** - Each service can be updated independently
- **Extensible** - Easy to add new endpoints or features
- **Maintainable** - Clear separation of concerns
- **Testable** - Comprehensive mocking and testing support

## 💡 Best Practices

1. **Always handle errors appropriately**
2. **Use TypeScript interfaces for type safety**
3. **Implement proper loading states in UI**
4. **Cache data when appropriate**
5. **Test authentication flows thoroughly**
6. **Monitor API performance and errors**

## 🤝 Contributing

When adding new services or endpoints:
1. Add the service interface in the appropriate microservice file
2. Update the service exports in `index.ts`
3. Add usage examples in `examples/serviceUsage.ts`
4. Update this README with new features
5. Add comprehensive TypeScript types