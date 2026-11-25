export type PrivacySectionId =
  | 'overview'
  | 'information-collection'
  | 'how-we-use'
  | 'information-sharing'
  | 'data-security'
  | 'cookies'
  | 'user-rights'
  | 'retention'
  | 'third-parties'
  | 'contact';

export const PRIVACY_SECTIONS: ReadonlyArray<{ id: PrivacySectionId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'information-collection', label: 'Information We Collect' },
  { id: 'how-we-use', label: 'How We Use Your Information' },
  { id: 'information-sharing', label: 'Information Sharing' },
  { id: 'data-security', label: 'Data Security' },
  { id: 'cookies', label: 'Cookies and Tracking' },
  { id: 'user-rights', label: 'Your Rights' },
  { id: 'retention', label: 'Data Retention' },
  { id: 'third-parties', label: 'Third-Party Services' },
  { id: 'contact', label: 'Contact Us' },
];
