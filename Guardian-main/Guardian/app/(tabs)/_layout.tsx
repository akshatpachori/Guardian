import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Icons for each tab as functions
const icons: Record<string, (props: { color: string }) => React.ReactElement> =
  {
    index: ({ color }) => <Ionicons name="home" size={24} color={color} />,
    reports: ({ color }) => (
      <MaterialCommunityIcons name="file-document" size={24} color={color} />
    ),
    help: ({ color }) => <MaterialIcons name="help" size={24} color={color} />,
    profile: ({ color }) => <Ionicons name="person" size={24} color={color} />,
  };

// Custom Tab Bar Component
const CustomTabBar = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  return (
    <View style={styles.tabContainer}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel ?? options.title ?? route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            Haptics.selectionAsync();
            navigation.navigate(route.name);
          }
        };

        const color = isFocused ? "#36ffea" : "#FFFFFF";
        const Icon = icons[route.name]; // get icon function

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            android_ripple={{ color: "transparent" }}
            style={styles.tabItem}
          >
            <View style={styles.iconLabel}>
              {Icon && <Icon color={color} />}
              <Text style={[styles.label, { color }]}>
                {typeof label === "function"
                  ? label({
                      focused: isFocused,
                      color,
                      children: route.name,
                      position: "below-icon",
                    })
                  : label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

// Main Layout with Custom Tab Bar
const _layout = () => {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="reports" options={{ title: "Reports" }} />
      <Tabs.Screen name="help" options={{ title: "Help" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
};

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#023047",
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
    alignItems: "center",
    elevation: 0,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  iconLabel: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
});

export default _layout;
