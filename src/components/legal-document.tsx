import { Link, router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { colors, spacing } from '@/theme/tokens';

type LegalSection = {
  title: string;
  paragraphs: string[];
};

type LegalDocumentProps = {
  title: string;
  effectiveDate: string;
  version: string;
  intro: string;
  sections: LegalSection[];
  otherDocument: { href: Href; label: string };
};

export function LegalDocument({
  title,
  effectiveDate,
  version,
  intro,
  sections,
  otherDocument,
}: LegalDocumentProps) {
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <AppText variant="display" accessibilityRole="header">{title}</AppText>
        <AppText variant="caption" color={colors.muted}>
          Effective {effectiveDate} · Version {version}
        </AppText>
        <AppText>{intro}</AppText>
      </View>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">{section.title}</AppText>
          {section.paragraphs.map((paragraph) => (
            <AppText key={paragraph} color={colors.ink}>{paragraph}</AppText>
          ))}
        </View>
      ))}

      <View style={styles.links}>
        <Link href={otherDocument.href} accessibilityRole="link" style={styles.link}>
          Read the {otherDocument.label}
        </Link>
        <Button label="Back to sign up" tone="secondary" onPress={() => router.replace('/(auth)/signup')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xxl },
  hero: { gap: spacing.md, marginTop: spacing.xl },
  section: { gap: spacing.sm },
  links: { gap: spacing.lg, paddingTop: spacing.md },
  link: { color: colors.orangeDark, textDecorationLine: 'underline' },
});
