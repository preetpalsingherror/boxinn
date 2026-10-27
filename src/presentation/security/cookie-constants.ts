// Cookie and header constant definitions
// Zero external or Node.js dependencies so this file is safe for both client and server bundles.

export const SESSION_COOKIE_NAME = 'boxinn_session';
export const HOST_SESSION_COOKIE_NAME = '__Host-boxinn_session';
export const CSRF_COOKIE_NAME = 'boxinn_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

// 30 days in seconds
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
