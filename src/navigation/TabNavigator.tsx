import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import TodayScreen from '../screens/TodayScreen';
import KnowledgeVaultScreen from '../screens/KnowledgeVaultScreen';
import CalendarScreen from '../screens/CalendarScreen';
import { colors } from '../theme/colors';

export type TabParamList = {
  오늘: { focusTodoId?: string } | undefined;
  지식창고: { focusMemoId?: string } | undefined;
  캘린더: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  오늘: 'today-outline',
  지식창고: 'library-outline',
  캘린더: 'calendar-outline',
};

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name as keyof TabParamList]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="오늘" component={TodayScreen} options={{ tabBarLabel: '할 일' }} />
      <Tab.Screen name="지식창고" component={KnowledgeVaultScreen} />
      <Tab.Screen name="캘린더" component={CalendarScreen} />
    </Tab.Navigator>
  );
}
