// app/_layout.tsx
import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../context/AuthProvider";
import "./global.css";

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments(); // Current route segments

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  const inAuthGroup = segments[0] !== "(tabs)";

  // If user is not logged in and trying to access a protected route
  if (!user && !inAuthGroup) {
    return <Redirect href="/login" />;
  }

  // If user is logged in and in auth group, redirect to main tabs
  // BUT allow access to ReportDetails and other protected screens
  if (
    user &&
    inAuthGroup &&
    segments[0] !== "chat" &&
    segments[0] !== "ReportDetails"
  ) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar backgroundColor="#000" barStyle="light-content" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Auth screens */}
        <Stack.Screen name="login" />
        <Stack.Screen name="welcome" />

        {/* Main tabs */}
        <Stack.Screen name="(tabs)" />

        {/* Additional screens outside tabs */}
        <Stack.Screen name="chat" />
        <Stack.Screen
          name="ReportDetails"
          options={{
            headerShown: false,
            title: "Report Details",
            headerBackTitle: "Reports",
          }}
        />
      </Stack>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthenticatedLayout />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
});
