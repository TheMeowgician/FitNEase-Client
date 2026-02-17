import React, { useState } from 'react';
import { View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { API_CONFIG } from '../../config/api.config';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  profilePicture?: string | null;
  size?: AvatarSize;
  style?: ViewStyle;
  borderWidth?: number;
  borderColor?: string;
  backgroundColor?: string;
  iconColor?: string;
}

const SIZE_MAP: Record<AvatarSize, { container: number; icon: number }> = {
  xs: { container: 32, icon: 16 },
  sm: { container: 48, icon: 24 },
  md: { container: 64, icon: 28 },
  lg: { container: 70, icon: 32 },
  xl: { container: 100, icon: 48 },
};

function getFullMediaUrl(relativePath: string): string {
  if (!relativePath) return '';
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  return `${API_CONFIG.MEDIA_SERVICE_URL}${relativePath}`;
}

export const Avatar: React.FC<AvatarProps> = ({
  profilePicture,
  size = 'md',
  style,
  borderWidth,
  borderColor,
  backgroundColor = COLORS.PRIMARY[600],
  iconColor = 'white',
}) => {
  const [hasError, setHasError] = useState(false);
  const dimensions = SIZE_MAP[size];
  const imageUrl = profilePicture ? getFullMediaUrl(profilePicture) : null;
  const showImage = !!imageUrl && !hasError;

  return (
    <View
      style={[
        {
          width: dimensions.container,
          height: dimensions.container,
          borderRadius: dimensions.container / 2,
          backgroundColor,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          overflow: 'hidden' as const,
        },
        borderWidth !== undefined && { borderWidth, borderColor: borderColor || 'white' },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: dimensions.container, height: dimensions.container }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          onError={() => setHasError(true)}
        />
      ) : (
        <Ionicons name="person" size={dimensions.icon} color={iconColor} />
      )}
    </View>
  );
};
