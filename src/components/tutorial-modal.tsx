import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/theme/tokens';

type TutorialModalProps = {
  visible: boolean;
  onClose: () => void;
};

const steps = [
  {
    eyebrow: '01 · HOME',
    icon: 'sun' as const,
    title: 'Put the sock up when you need space.',
    body: 'Home is your live status. Tap the big sock to start or end a session, then see friends who are up and the groups you belong to.',
  },
  {
    eyebrow: '02 · FRIENDS',
    icon: 'users' as const,
    title: 'Find people by username.',
    body: 'Open Friends, search for a username, and tap Add. Requests appear here too, so you can accept, decline, or remove connections.',
  },
  {
    eyebrow: '03 · GROUPS',
    icon: 'layers' as const,
    title: 'Make a crew, then bring friends in.',
    body: 'Open Groups and tap the plus button to name a group. Inside a group, owners and admins can use Add friends to add people you already accepted.',
  },
  {
    eyebrow: '04 · WRAPPED',
    icon: 'bar-chart-2' as const,
    title: 'See the recap without sharing your history.',
    body: 'Wrapped shows your own patterns. Group Wrapped only shows opt-in, aggregated stats—your raw session history stays private.',
  },
  {
    eyebrow: '05 · YOU',
    icon: 'sliders' as const,
    title: 'Tune privacy, notifications, and your account.',
    body: 'Use You for your profile, who can see your sock, group-stat preferences, password reset, and this tutorial whenever you need a refresher.',
  },
];

export function TutorialModal({ visible, onClose }: TutorialModalProps) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const close = () => {
    setIndex(0);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={styles.screen}>
        <View style={styles.topline}>
          <AppText variant="caption" color={colors.muted}>
            SOCK WALKTHROUGH
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Close tutorial" onPress={close} style={styles.close}>
            <Feather name="x" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Feather name={step.icon} size={38} color={colors.cream} />
          </View>
          <AppText variant="caption" color={colors.orangeDark}>{step.eyebrow}</AppText>
          <AppText variant="display" style={styles.title}>{step.title}</AppText>
          <AppText color={colors.muted} style={styles.body}>{step.body}</AppText>
        </View>

        <View style={styles.footer}>
          <View style={styles.progress} accessibilityLabel={`Tutorial step ${index + 1} of ${steps.length}`}>
            {steps.map((item, itemIndex) => (
              <View key={item.eyebrow} style={[styles.dot, itemIndex === index && styles.dotActive]} />
            ))}
          </View>
          <View style={styles.actions}>
            {index > 0 ? <Button label="Back" tone="quiet" onPress={() => setIndex((value) => value - 1)} /> : <View />}
            <Button
              label={isLast ? 'Start using Sock' : 'Next'}
              onPress={isLast ? close : () => setIndex((value) => value + 1)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'space-between', backgroundColor: colors.cream, padding: spacing.xl },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.paper },
  content: { flex: 1, justifyContent: 'center', gap: spacing.lg, maxWidth: 560, alignSelf: 'center' },
  iconWrap: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center', borderRadius: 39, backgroundColor: colors.ink, marginBottom: spacing.sm },
  title: { maxWidth: 520 },
  body: { fontSize: 17, lineHeight: 27, maxWidth: 520 },
  footer: { gap: spacing.lg },
  progress: { flexDirection: 'row', gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.line },
  dotActive: { width: 28, backgroundColor: colors.orange },
  actions: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
