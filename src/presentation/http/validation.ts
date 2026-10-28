/**
 * Strict input validation helpers for presentation layer requests.
 */

export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  // Standard RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return trimmed.length >= 3 && trimmed.length <= 254 && emailRegex.test(trimmed);
}

export function validatePassword(password: unknown): { valid: boolean; reason?: string } {
  if (typeof password !== 'string') {
    return { valid: false, reason: 'Password must be a string.' };
  }
  if (password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, reason: 'Password must not exceed 128 characters.' };
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumberOrSpecial = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  if (!hasUpper || !hasLower || !hasNumberOrSpecial) {
    return {
      valid: false,
      reason: 'Password must contain at least one uppercase letter, one lowercase letter, and one number or symbol.',
    };
  }

  return { valid: true };
}

export function sanitizeString(val: unknown, maxLen: number = 256): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

export function extractClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/**
 * Normalizes video links (YouTube, YouTube Shorts, Vimeo) into secure embeddable iframe URLs.
 */
export function normalizeVideoEmbedUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    // Already an embed URL
    if (trimmed.includes('youtube.com/embed/') || trimmed.includes('youtube-nocookie.com/embed/')) {
      return trimmed;
    }

    // youtu.be/VIDEO_ID
    const youtuBeMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (youtuBeMatch && youtuBeMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${youtuBeMatch[1]}`;
    }

    // youtube.com/watch?v=VIDEO_ID
    const ytWatchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    if (ytWatchMatch && ytWatchMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${ytWatchMatch[1]}`;
    }

    // youtube.com/shorts/VIDEO_ID
    const ytShortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
    if (ytShortsMatch && ytShortsMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${ytShortsMatch[1]}`;
    }

    // vimeo.com/VIDEO_ID
    const vimeoMatch = trimmed.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)(?:$|\/|\?)/);
    if (vimeoMatch && (vimeoMatch[3] || vimeoMatch[1])) {
      const vimeoId = vimeoMatch[3] || vimeoMatch[1];
      return `https://player.vimeo.com/video/${vimeoId}`;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}
