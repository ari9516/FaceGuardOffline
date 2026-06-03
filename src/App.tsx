/**
 * FaceGuard Offline - Secure Facial Recognition & Liveness Detection
 * Hackathon 7.0 Submission
 */

import React, { useState, useEffect } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, Alert } from 'react-native';

import {
  HomeScreen,
  ResultScreen,
  SyncScreen,
  SplashScreen,
  AdminScreen
} from './screens/HomeScreen';
import EnrollScreen from './screens/EnrollScreen';
import AuthScreen from './screens/AuthScreen';
import { FaceGuardProvider } from './context/FaceGuardContext';
import { DatabaseService } from './services/DatabaseService';
import { ModelService } from './services/ModelService';

const Stack = createNativeStackNavigator();

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0A0F1E',
    primary: '#00D4FF',
  },
};

export default function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      await DatabaseService.initialize();
      await ModelService.loadModel();
    } catch (e) {
      console.warn("Initialization warning (Models might be missing):", e);
    }
    setInitialized(true);
  };

  if (!initialized) {
    return null;
  }

  return (
    <FaceGuardProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0A0F1E"
      />
      <NavigationContainer theme={AppTheme}>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Enroll" component={EnrollScreen} />
          <Stack.Screen name="Auth" component={AuthScreen} />
          <Stack.Screen name="Result" component={ResultScreen} />
          <Stack.Screen name="Sync" component={SyncScreen} />
          <Stack.Screen name="Admin" component={AdminScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </FaceGuardProvider>
  );
}
