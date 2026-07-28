/**
 * Onboarding group layout.
 * Only accessible when the user is authenticated but has not completed onboarding.
 */

import { Stack } from 'expo-router';
import React from 'react';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
