import { LegalDocument } from '@/components/legal-document';
import { legalDocuments, legalTodo } from '@/content/legal';
import type { Href } from 'expo-router';

export default function PrivacyScreen() {
  return (
    <LegalDocument
      title="Privacy Policy"
      effectiveDate={legalDocuments.effectiveDate}
      version={legalDocuments.privacyPolicyVersion}
      intro={`This policy explains how Sock handles information. Sock's operator and privacy contact must be filled in before public launch: ${legalTodo.operator}; ${legalTodo.privacyContact}.`}
      otherDocument={{ href: '/terms' as Href, label: 'Terms of Service' }}
      sections={[
        {
          title: 'What Sock collects',
          paragraphs: [
            'Account information: your email address is held by Supabase Auth. Sock stores your username, optional display name, optional avatar, and account preferences in its application database.',
            'Age eligibility: at signup Sock checks the date of birth you enter to confirm that you are at least 13. The full date is removed from the account record after the check. Sock keeps only the 13+ eligibility result, the eligibility-rule version, and the time of confirmation.',
            'Social and activity information: friend requests and friendships, groups and memberships, your sock-status settings, sock session start/end times, visibility choices, and optional group-Wrapped participation. Your selected audience may see your current sock status; completed sessions and exact history remain private to you.',
            'Notifications: if you opt in on a mobile device, Sock stores your Expo push token, device platform, notification preference, and delivery-outbox status so it can send status notifications.',
            'Service and security information: Supabase, Vercel, Resend, Expo, and your network may process ordinary technical request information such as IP address, browser/device details, timestamps, and security logs under their own service operations. Retention periods and the responsible operator are TODO items that require completion before launch.',
          ],
        },
        {
          title: 'What Sock does not use',
          paragraphs: [
            'The current Sock app does not request your contacts or precise location. The codebase has no advertising SDK, behavioral-ad analytics SDK, or third-party error-monitoring SDK integration. If that changes, this policy must be updated before the change ships.',
          ],
        },
        {
          title: 'How Sock uses and shares information',
          paragraphs: [
            'Sock uses information to create and secure accounts, show profiles and friend/group features, operate sock sessions, deliver notifications, provide password recovery and email confirmation, prevent abuse, and maintain the service.',
            'Sock shares information with service providers that process it to run the app: Supabase (authentication, database, realtime, and private avatar storage), Resend through Supabase-configured email delivery (account email), Vercel (web hosting), and Expo (push-notification delivery). Sock does not sell personal information.',
            'Other users receive only information permitted by your friendship, group membership, and visibility settings. Username, display name, and avatar may be returned in profile search and social views where Sock access rules allow it.',
          ],
        },
        {
          title: 'Retention and deletion',
          paragraphs: [
            'You can permanently delete your account from Settings. This deletes the Auth account and application records that cascade from it, including profile, friendships, groups/memberships as applicable, sessions, preferences, and device tokens. Sock also removes avatar objects in the private avatars bucket before deleting the account.',
            'Deletion cannot retract a push notification already delivered to another device. Provider backups, email-delivery logs, and infrastructure logs may remain for the provider retention period. The operator must document those exact periods and a deletion-request contact before launch.',
          ],
        },
        {
          title: 'Security, children, and your choices',
          paragraphs: [
            'Sock uses authenticated access controls, row-level database policies, and private avatar storage. No online service can promise absolute security, so use a unique password and keep your device secure.',
            'Sock is not for children under 13. The signup system rejects under-13 registrations before an account is created. If Sock learns that an account belongs to a child under 13, it will disable and delete the account and related personal information using its documented response process.',
            `Depending on where you live, you may have privacy rights. Contact ${legalTodo.privacyContact} to exercise them. Regional disclosures, legal basis, and jurisdiction-specific rights are TODO items requiring legal review before launch.`,
          ],
        },
        {
          title: 'Changes and contact',
          paragraphs: [
            'Sock may update this policy when the service or legal requirements change. Material changes will be posted with a new effective date and, when required, presented for renewed acceptance.',
            `Privacy contact: ${legalTodo.privacyContact}. General operator contact: ${legalTodo.contact}.`,
          ],
        },
      ]}
    />
  );
}
