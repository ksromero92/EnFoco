/**
 * Tab layout — 5 main tabs: Hoy, Semana, Progreso, Rutinas, Perfil.
 * Uses HapticTab for iOS haptic feedback and MaterialIcons via IconSymbol.
 *
 * Tab bar colors are hardcoded to EnFoco brand values so they are always
 * visible on the white bar regardless of the OS color scheme.
 */

import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

// Explicit brand values — do not derive from colorScheme to avoid invisible
// active icons on the white tab bar.
const TAB_ACTIVE_COLOR = '#2563EB';
const TAB_INACTIVE_COLOR = '#9CA3AF';
const TAB_BAR_BG = '#FFFFFF';
const TAB_BORDER_COLOR = '#E2E8F0';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: TAB_ACTIVE_COLOR,
        tabBarInactiveTintColor: TAB_INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: TAB_BAR_BG,
          borderTopColor: TAB_BORDER_COLOR,
          borderTopWidth: 1,
          // Ensure the bar is always opaque on all platforms
          ...(Platform.OS === 'android' && { elevation: 8 }),
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
