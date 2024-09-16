import { mergeTranslations } from 'react-admin';
import polyglotI18nProvider from 'ra-i18n-polyglot';
import englishMessages from 'ra-language-english';
import { raSupabaseEnglishMessages } from 'ra-supabase';

const raSupabaseEnglishMessagesOverride = {
    'ra-supabase': {
        auth: {
            password_reset: 'Check your emails for a Reset Password message.',
        },
    },
};

export const i18nProvider = polyglotI18nProvider(
    () => {
        return mergeTranslations(
            englishMessages,
            raSupabaseEnglishMessages,
            raSupabaseEnglishMessagesOverride
        );
    },
    'en',
    [{ locale: 'en', name: 'English' }],
    { allowMissing: true }
);
