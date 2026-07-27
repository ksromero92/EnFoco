/**
 * Auth group layout — renders the sign-in (and future sign-up/forgot) screens.
 * This group is only accessible when the user does NOT have an active session.
 */

import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
    </Stack>
  );
}
