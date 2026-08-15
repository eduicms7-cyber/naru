import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import TodayScreen from '../screens/TodayScreen';
import KnowledgeVaultScreen from '../screens/KnowledgeVaultScreen';
import CalendarScreen from '../screens/CalendarScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import { colors } from '../theme/colors';
import { useIsWideLayout } from '../utils/layout';
import SidebarTabBar from './SidebarTabBar';
import { ICONS, TabParamList } from './tabConfig';

export type { TabParamList };

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  const isWide = useIsWideLayout();

  return (
    <Tab.Navigator
      tabBar={isWide ? (props) => <SidebarTabBar {...props} /> : undefined}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarPosition: isWide ? 'left' : 'bottom',
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
      <Tab.Screen name="즐겨찾기" component={FavoritesScreen} />
    </Tab.Navigator>
  );
}
