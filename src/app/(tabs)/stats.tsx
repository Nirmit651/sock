import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FadeIn } from '@/components/ui/fade-in';
import { Screen } from '@/components/ui/screen';
import { useWrapped } from '@/hooks/use-data';
import { formatDuration } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';
import { colors, radius, spacing } from '@/theme/tokens';

export default function StatsScreen() {
  const { user } = useAuth();
  const wrapped = useWrapped(user?.id);
  const stats = wrapped.data;

  return (
    <Screen refreshing={wrapped.isRefetching} onRefresh={() => void wrapped.refetch()} contentStyle={styles.screen}>
      <FadeIn>
        <View style={styles.intro}>
          <AppText variant="caption" color={colors.orange}>SOCK WRAPPED</AppText>
          <AppText variant="display">Your privacy, by the numbers.</AppText>
          <AppText color={colors.muted}>Only you can see this. Group stats use separate aggregates.</AppText>
        </View>
      </FadeIn>

      {wrapped.isError ? (
        <ErrorState title="Wrapped unavailable" onRetry={() => void wrapped.refetch()} />
      ) : stats?.session_count ? (
        <>
          <FadeIn delay={80}>
            <View style={[styles.panel, styles.orange]}>
              <AppText variant="caption" color={colors.cream}>ALL-TIME SESSIONS</AppText>
              <AppText style={styles.mega} color={colors.cream}>{stats.session_count}</AppText>
              <AppText color={colors.cream}>That’s {formatDuration(stats.total_seconds)} of expertly signaled privacy.</AppText>
            </View>
          </FadeIn>

          <FadeIn delay={130}>
            <View style={[styles.panel, styles.ink]}>
              <AppText variant="caption" color={colors.lilac}>THE PERSONAL BEST</AppText>
              <AppText variant="display" color={colors.cream}>{formatDuration(stats.longest_seconds)}</AppText>
              <AppText color="#D9CFC2">Longest session. Hydration breaks remain untracked.</AppText>
            </View>
          </FadeIn>

          <View style={styles.metrics}>
            <View style={styles.metric}>
              <AppText variant="caption" color={colors.muted}>AVERAGE</AppText>
              <AppText variant="title">{formatDuration(stats.average_seconds)}</AppText>
            </View>
            <View style={styles.metric}>
              <AppText variant="caption" color={colors.muted}>CURRENT STREAK</AppText>
              <AppText variant="title">{stats.current_streak} day{stats.current_streak === 1 ? '' : 's'}</AppText>
            </View>
          </View>

          <FadeIn delay={180}>
            <View style={[styles.panel, styles.lilac]}>
              <AppText variant="caption">YOUR PRIME TIME</AppText>
              <AppText variant="display">{stats.favorite_time_range}</AppText>
              <AppText>
                {stats.favorite_weekday}s do the heavy lifting. Peak month: {stats.most_active_month}.
              </AppText>
            </View>
          </FadeIn>

          <AppText variant="caption" color={colors.muted} style={styles.note}>
            Wrapped is calculated in UTC for this MVP. No friend can query your completed sessions or exact timestamps.
          </AppText>
        </>
      ) : wrapped.isLoading ? null : (
        <EmptyState
          title="Your Wrapped is still in the wash"
          body="Complete a sock session and the numbers will start telling a story."
          emoji="🫧"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.xl },
  intro: { gap: spacing.md, paddingTop: spacing.md },
  panel: { minHeight: 240, borderRadius: radius.lg, padding: spacing.xl, justifyContent: 'space-between', gap: spacing.lg },
  orange: { backgroundColor: colors.orange },
  ink: { backgroundColor: colors.ink },
  lilac: { backgroundColor: colors.lilac },
  mega: { fontSize: 104, lineHeight: 108, letterSpacing: -6 },
  metrics: { flexDirection: 'row', gap: spacing.xl },
  metric: { flex: 1, borderTopWidth: 2, borderTopColor: colors.ink, paddingTop: spacing.md, gap: spacing.sm },
  note: { textAlign: 'center', paddingHorizontal: spacing.lg },
});
