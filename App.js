import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MockProvider } from './src/context/MockContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MockProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </MockProvider>
    </GestureHandlerRootView>
  );
}
