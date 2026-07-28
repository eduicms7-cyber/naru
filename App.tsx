import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TabNavigator from './src/navigation/TabNavigator';
import LoginScreen from './src/screens/LoginScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { colors } from './src/theme/colors';

function Root() {
  const { session, loading, isPasswordRecovery } = useAuth();

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  if (isPasswordRecovery) {
    return <ResetPasswordScreen />;
  }

  return session ? <TabNavigator /> : <LoginScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <Root />
        </NavigationContainer>
      </AuthProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
