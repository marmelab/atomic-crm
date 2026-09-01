/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CRM_API_URL?: string;
  readonly VITE_COGNITO_USER_POOL_ID?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
  readonly VITE_COGNITO_DOMAIN?: string;
  readonly VITE_COGNITO_REDIRECT_URI?: string;
  readonly VITE_COGNITO_LOGOUT_URI?: string;
  readonly VITE_DISABLE_EMAIL_PASSWORD_AUTHENTICATION?: string;
  readonly VITE_GOOGLE_WORKPLACE_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
