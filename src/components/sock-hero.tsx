import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { colors, radius, spacing } from '@/theme/tokens';

type SockHeroProps = {
  isActive: boolean;
  busy: boolean;
  onToggle: () => void;
};

export function SockHero({ isActive, busy, onToggle }: SockHeroProps) {
  const [scale] = useState(() => new Animated.Value(1));
  const [halo] = useState(() => new Animated.Value(isActive ? 0.75 : 0));

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isActive ? 1.04 : 1,
      damping: 11,
      stiffness: 170,
      useNativeDriver: true,
    }).start();

    if (!isActive) {
      halo.stopAnimation();
      halo.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, { toValue: 0.95, duration: 1100, useNativeDriver: true }),
        Animated.timing(halo, { toValue: 0.5, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [halo, isActive, scale]);

  return (
    <Animated.View style={[styles.hero, { transform: [{ scale }] }]}>
      <Image
        source={require('../../assets/images/sock-hero.png')}
        contentFit="cover"
        contentPosition="center"
        style={StyleSheet.absoluteFill}
        transition={250}
      />
      <View style={styles.scrim} />
      <Animated.View style={[styles.halo, { opacity: halo }]} />
      <View style={styles.copy}>
        <View style={[styles.badge, isActive && styles.badgeActive]}>
          <View style={[styles.dot, isActive && styles.dotActive]} />
          <AppText variant="caption" color={colors.cream}>
            {isActive ? 'SOCK IS UP' : 'SOCK IS DOWN'}
          </AppText>
        </View>
        <View style={styles.bottom}>
          <View style={styles.message}>
            <AppText variant="display" color={colors.cream}>
              {isActive ? 'Privacy,\nplease.' : 'Need the\nroom?'}
            </AppText>
            <AppText color="#EADCC8">
              {isActive ? 'Your selected people can see the signal.' : 'One tap. Zero awkward group texts.'}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isActive ? 'Take Sock Down' : 'Put Sock Up'}
            accessibilityState={{ busy }}
            disabled={busy}
            onPress={onToggle}
            style={({ pressed }) => [
              styles.action,
              isActive && styles.actionActive,
              pressed && styles.actionPressed,
              busy && styles.actionBusy,
            ]}
          >
            <Feather
              name={isActive ? 'arrow-down' : 'arrow-up'}
              size={24}
              color={isActive ? colors.ink : colors.cream}
            />
            <AppText variant="label" color={isActive ? colors.ink : colors.cream}>
              {busy ? 'One sec…' : isActive ? 'Take it down' : 'Put sock up'}
            </AppText>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 510,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15, 12, 11, 0.44)',
  },
  halo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(240, 100, 59, 0.18)',
    top: 110,
    right: -50,
  },
  copy: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(21, 19, 19, 0.75)',
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  badgeActive: { backgroundColor: 'rgba(166, 58, 41, 0.9)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.muted },
  dotActive: { backgroundColor: colors.cream },
  bottom: { gap: spacing.xl },
  message: { gap: spacing.md, maxWidth: 290 },
  action: {
    minHeight: 58,
    alignSelf: 'stretch',
    backgroundColor: colors.orange,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actionActive: { backgroundColor: colors.cream },
  actionPressed: { transform: [{ scale: 0.98 }] },
  actionBusy: { opacity: 0.65 },
});
