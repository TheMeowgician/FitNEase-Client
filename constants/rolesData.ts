import { RoleData } from '../components/auth/RoleCard';
import { COLORS } from './colors';

export const rolesData: RoleData[] = [
  {
    id: 'member',
    title: 'Member',
    description: 'Join our community and access personalized Tabata workouts with AI-powered recommendations.',
    features: [
      'Personalized Tabata workout plans',
      'AI-powered exercise recommendations',
      'Join group workout sessions',
      'Track your fitness progress',
      'Achievement system & badges',
      'Access to exercise library',
      'Community leaderboards',
      'BMI and health tracking'
    ],
    icon: 'person',
    primaryColor: COLORS.PRIMARY[600],
    backgroundColor: COLORS.PRIMARY[50],
  },
  {
    id: 'mentor',
    title: 'Mentor',
    description: 'Lead and inspire others as a fitness mentor. Create content and manage workout groups.',
    features: [
      'Everything in Member plan',
      'Create custom workout plans',
      'Lead group workout sessions',
      'Content creation tools',
      'Client progress tracking',
      'Advanced analytics dashboard',
      'Monetization opportunities',
      'Priority support access'
    ],
    icon: 'medal',
    primaryColor: COLORS.SUCCESS[600],
    backgroundColor: COLORS.SUCCESS[50],
  },
];