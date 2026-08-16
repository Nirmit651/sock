import { Platform } from 'react-native';

export const colors = {
  ink: '#151313',
  inkSoft: '#3E3937',
  cream: '#FFF7E8',
  paper: '#F7ECD9',
  orange: '#F0643B',
  orangeDark: '#C94828',
  lilac: '#C9B8FF',
  mint: '#BEE3C0',
  white: '#FFFFFF',
  line: '#DED2BF',
  muted: '#7A716B',
  danger: '#A63A29',
  success: '#276749',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const font = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semibold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
} as const;

export const shadow = Platform.select({
  ios: {
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  android: { elevation: 5 },
  default: {},
});
