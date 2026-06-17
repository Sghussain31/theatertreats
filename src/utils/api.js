if (process.env.NODE_ENV === 'production' && !process.env.EXPO_PUBLIC_API_URL) {
  console.warn('[API Config Warning] EXPO_PUBLIC_API_URL environment variable is missing or unconfigured in production. Falling back to production URL.');
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://syvix-treats.loca.lt';
