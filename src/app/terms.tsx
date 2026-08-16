import { LegalDocument } from '@/components/legal-document';
import { legalDocuments, legalTodo } from '@/content/legal';
import type { Href } from 'expo-router';

export default function TermsScreen() {
  return (
    <LegalDocument
      title="Terms of Service"
      effectiveDate={legalDocuments.effectiveDate}
      version={legalDocuments.termsVersion}
      intro={`These Terms govern use of Sock. The service operator and governing law must be completed before public launch: ${legalTodo.operator}; ${legalTodo.governingLaw}.`}
      otherDocument={{ href: '/privacy' as Href, label: 'Privacy Policy' }}
      sections={[
        {
          title: 'Acceptance and eligibility',
          paragraphs: [
            'By checking the required signup box and creating an account, you agree to these Terms and acknowledge the Privacy Policy. You must be at least 13 years old to use Sock. Do not create or use an account for a child under 13.',
            'You must provide accurate account information, keep your password confidential, and promptly tell Sock if you believe your account has been accessed without permission.',
          ],
        },
        {
          title: 'Using Sock respectfully',
          paragraphs: [
            'Sock is a social status app for friends and groups. Do not use it to harass, threaten, impersonate, defraud, stalk, exploit others, distribute unlawful or infringing material, interfere with the service, bypass security or privacy controls, or violate applicable law.',
            'You are responsible for the username, display name, avatar, group names, and other material you submit. Do not upload content you do not have the right to use.',
          ],
        },
        {
          title: 'Privacy and social visibility',
          paragraphs: [
            'Your use of Sock is also governed by the Privacy Policy. You control whether your current sock status is visible to all accepted friends, selected groups, or nobody. Other people may still see information that you choose to share with them; use the controls thoughtfully.',
            'Sock may send account and security email, and may send push notifications if you enable them. You can adjust notification preferences in Settings.',
          ],
        },
        {
          title: 'Service operation',
          paragraphs: [
            'Sock may change, maintain, suspend, or discontinue features to operate the service, protect users, comply with law, or address misuse. Sock may suspend or terminate accounts that violate these Terms or create a safety or security risk.',
            `The service is provided as available. To the extent allowed by law, the operator disclaims warranties and limits liability. The exact limitation-of-liability, indemnity, dispute, and governing-law terms must be completed by qualified legal counsel before launch: ${legalTodo.governingLaw}.`,
          ],
        },
        {
          title: 'Account deletion, changes, and contact',
          paragraphs: [
            'You may delete your account from Settings. Deletion is permanent, subject to the limited provider and backup retention described in the Privacy Policy.',
            `If Sock materially changes these Terms, it will post an updated version and, where required, ask you to accept it before continued use. Contact the operator at ${legalTodo.contact}.`,
          ],
        },
      ]}
    />
  );
}
