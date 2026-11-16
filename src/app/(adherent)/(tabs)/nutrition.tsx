import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';

export default function NutritionTab() {
  const { t } = useTranslation();
  return <ComingSoon title={t('nav.nutrition')} />;
}
