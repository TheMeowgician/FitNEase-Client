import { RoleData } from '../components/auth/RoleCard';
import { COLORS } from './colors';

export const rolesData: RoleData[] = [
  {
    id: 'member',
    title: 'Member',
    subtitle: 'Perfect for fitness enthusiasts',
    description: 'Get personalized Tabata workouts powered by AI and track your fitness journey.',
    features: [
      { text: 'AI-powered workout recommendations', icon: 'sparkles' },
      { text: 'Join group workout sessions', icon: 'people' },
      { text: 'Track your fitness progress', icon: 'trending-up' },
      { text: 'Earn achievements & badges', icon: 'trophy' },
      { text: 'Access exercise library', icon: 'library' },
      { text: 'Weekly check-ins & assessments', icon: 'clipboard' },
    ],
    icon: 'fitness',
    primaryColor: COLORS.PRIMARY[600],
    secondaryColor: COLORS.PRIMARY[500],
    backgroundColor: '#EEF2FF',
  },
  {
    id: 'mentor',
    title: 'Mentor',
    subtitle: 'Lead and inspire others',
    description: 'Guide members through their fitness journey and lead group workout sessions.',
    features: [
      { text: 'All Member features included', icon: 'checkmark-done' },
      { text: 'Create & lead group sessions', icon: 'people-circle' },
      { text: 'Invite members to your groups', icon: 'person-add' },
      { text: 'View member progress & stats', icon: 'stats-chart' },
      { text: 'Real-time workout synchronization', icon: 'sync' },
      { text: 'Video call during workouts', icon: 'videocam' },
    ],
    icon: 'ribbon',
    primaryColor: '#059669',
    secondaryColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
];
