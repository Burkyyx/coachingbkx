import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';

export default function CommunityTab() {
  const { t } = useTranslation();
  return <ComingSoon title={t('nav.community')} />;
}
