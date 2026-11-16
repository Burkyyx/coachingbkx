import 'i18next';

import type { resources, defaultNS } from './index';

// Typage des clés de traduction : `t('cle.inexistante')` provoque une erreur TypeScript.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['fr'];
  }
}
