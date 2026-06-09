if (process.env.NODE_ENV === 'production' && !process.env.EXPO_PUBLIC_API_URL) {
  throw new Error('[API Config Error] EXPO_PUBLIC_API_URL environment variable is missing or unconfigured in production.');
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL;
