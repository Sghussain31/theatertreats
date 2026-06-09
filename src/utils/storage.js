import { Platform, NativeModules } from 'react-native';

let AsyncStorage;

// Safely load AsyncStorage only if we are on a native platform and the native module is linked.
// This prevents the 'AsyncStorageError: Native module is null' crash on web or unlinked native runs.
if (Platform.OS !== 'web') {
  const hasNativeModule = NativeModules && (NativeModules.RNCAsyncStorage || NativeModules.RNC_AsyncSQLiteDBStorage);
  if (hasNativeModule) {
    try {
      AsyncStorage = require('@react-native-async-storage/async-storage').default;
    } catch (_e) {
      console.warn('[Storage Config] Failed to require @react-native-async-storage/async-storage, using memory fallback');
    }
  } else {
    console.warn('[Storage Config] Native AsyncStorage module is missing. Using memory fallback.');
  }
}

// In-memory fallback if storage fails
const memoryStore = {};

export const setItem = async (key, value) => {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else if (AsyncStorage) {
      await AsyncStorage.setItem(key, value);
    } else {
      memoryStore[key] = value;
    }
  } catch (error) {
    console.error(`[Storage Error] Failed to set ${key}:`, error);
  }
};

export const getItem = async (key) => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else if (AsyncStorage) {
      return await AsyncStorage.getItem(key);
    } else {
      return memoryStore[key] || null;
    }
  } catch (error) {
    console.error(`[Storage Error] Failed to get ${key}:`, error);
    return null;
  }
};

export const removeItem = async (key) => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else if (AsyncStorage) {
      await AsyncStorage.removeItem(key);
    } else {
      delete memoryStore[key];
    }
  } catch (error) {
    console.error(`[Storage Error] Failed to remove ${key}:`, error);
  }
};
