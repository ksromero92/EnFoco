/**
 * Tab layout — 5 main tabs: Hoy, Semana, Progreso, Rutinas, Perfil.
 * Uses HapticTab for iOS haptic feedback and MaterialIcons via IconSymbol.
 */

import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Colors, Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const activeTint = Colors[colorScheme ?? 'light'].tabIconSelected;
  const inactiveTint = Colors[colorScheme ?? 'light'].tabIconDefault;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: Palette.surface,
          borderTopColor: Palette.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="today" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="week"
        options={{
          title: 'Semana',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="date-range" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="bar-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="routines"
        options={{
          title: 'Rutinas',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="repeat" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
