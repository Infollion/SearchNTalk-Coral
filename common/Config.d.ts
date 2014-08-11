/// <reference path="../_references.d.ts" />
declare class Config {
    static ENV: string;
    static VERSION: string;
    static SESSION_EXPIRY: string;
    static ENABLE_HTTP: string;
    static ENABLE_HTTPS: string;
    static SSL_KEY: string;
    static SSL_CERT: string;
    static PROFILE_IMAGE_PATH: string;
    static LOGO_PATH: string;
    static TEMP_IMAGE_PATH: string;
    static PROFILE_IMAGE_BASE_URL: string;
    static DATABASE_HOST: string;
    static DATABASE_NAME: string;
    static DATABASE_USER: string;
    static DATABASE_PASS: string;
    static REF_DATABASE_NAME: string;
    static DATABASE_SOCKET: string;
    static REDIS_HOST: string;
    static REDIS_SESSION_PORT: string;
    static REDIS_VERIFICATION_PORT: string;
    static REDIS_STATS_PORT: string;
    static EMAIL_TEMPLATE_BASE_DIR: string;
    static EMAIL_CDN_BASE_URI: string;
    static WIDGET_TEMPLATE_BASE_DIR: string;
    static WIDGET_CDN_BASE_URI: string;
    static DASHBOARD_URI: string;
    static DASHBOARD_HTTP_PORT: string;
    static DASHBOARD_HTTPS_PORT: string;
    static ACCESS_TOKEN_EXPIRY: string;
    static PASSWORD_SEED_LENGTH: string;
    static PROCESS_SCHEDULED_CALLS_TASK_INTERVAL_SECS: string;
    static CALL_REMINDER_LEAD_TIME_SECS: string;
    static CALL_RETRY_DELAY_SECS: string;
    static MINIMUM_DURATION_FOR_SUCCESS: string;
    static MAXIMUM_REATTEMPTS: string;
    static MINIMUM_YEAR: string;
    static CALL_REVIEW_EXPERT_QUESTION_COUNT: string;
    static CALL_REVIEW_USER_QUESTION_COUNT: string;
    static DEFAULT_NETWORK_ID: string;
    static TIMEZONE_REFRESH_INTERVAL_SECS: string;
    static CALLBACK_NUMBER: string;
    static MAXIMUM_CALLBACK_DELAY: string;
    static DELAY_AFTER_CALLBACK: string;
    static CALL_NETWORK_CHARGES_PER_MIN_DOLLAR: string;
    static CALL_TAX_PERCENT: string;
    static CALL_CANCELLATION_CHARGES_PERCENT: string;
    private static version;
    private static ctor;
    static get(key: string): any;
    static set(key: string, val: any): void;
}
export = Config;