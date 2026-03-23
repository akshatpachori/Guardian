import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase";

export default function ProfileScreen() {
  const user = auth.currentUser;
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // router.replace("/login"); // Go to login screen
    } catch (err) {
      console.log("Logout error:", err);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 mb-16">
        {/* Header with User Info */}
        <View className="bg-teal-500 px-6 pt-6 pb-8 rounded-b-3xl shadow-lg ">
          <View className="items-center">
            <View className="bg-white w-24 h-24 rounded-full items-center justify-center mb-4 shadow-md">
              <Ionicons name="person" size={48} color="#14b8a6" />
            </View>
            <Text className="text-white text-2xl font-bold mb-1">
              {user?.displayName || "Guardian User"}
            </Text>
            <Text className="text-white/90 text-sm">
              {user?.email || "you@example.com"}
            </Text>
          </View>
        </View>

        <View className="px-5 py-6">
          {/* Quick Actions */}
          <View className="flex-row justify-between mb-6 -mt-8">
            <QuickAction
              label="Drone"
              icon="hardware-chip"
              color="#3b82f6"
              bgColor="#dbeafe"
              onPress={() => router.push("/(tabs)")}
            />
            <QuickAction
              label="Support"
              icon="headset"
              color="#8b5cf6"
              bgColor="#ede9fe"
              onPress={() => router.push("/(tabs)/help")}
            />
            <QuickAction
              label="Reports"
              icon="document-text"
              color="#f59e0b"
              bgColor="#fef3c7"
              onPress={() => router.push("/(tabs)/reports")}
            />
          </View>

          {/* Account Section */}
          <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
            <Text className="text-slate-500 text-xs font-bold mb-3 uppercase tracking-wide">
              Account
            </Text>
            <MenuItem
              label="My Scans"
              icon="scan"
              iconColor="#14b8a6"
              iconBg="#f0fdfa"
            />
            <MenuItem
              label="Saved Routes"
              icon="map"
              iconColor="#3b82f6"
              iconBg="#dbeafe"
            />
            <MenuItem
              label="Emergency Contacts"
              icon="call"
              iconColor="#ef4444"
              iconBg="#fee2e2"
              showBorder={false}
            />
          </View>

          {/* Settings Section */}
          <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
            <Text className="text-slate-500 text-xs font-bold mb-3 uppercase tracking-wide">
              Settings
            </Text>
            <MenuItem
              label="Drone Settings"
              icon="settings"
              iconColor="#8b5cf6"
              iconBg="#ede9fe"
            />
            <MenuItem
              label="Notifications"
              icon="notifications"
              iconColor="#f59e0b"
              iconBg="#fef3c7"
            />
            <MenuItem
              label="Privacy"
              icon="lock-closed"
              iconColor="#64748b"
              iconBg="#f1f5f9"
              showBorder={false}
            />
          </View>

          {/* Help Section */}
          <View className="bg-white rounded-2xl p-4 mb-6 border border-gray-100 shadow-sm">
            <Text className="text-slate-500 text-xs font-bold mb-3 uppercase tracking-wide">
              Support
            </Text>
            <MenuItem
              label="Help & Support"
              icon="help-circle"
              iconColor="#14b8a6"
              iconBg="#f0fdfa"
            />
            <MenuItem
              label="About Guardian"
              icon="information-circle"
              iconColor="#3b82f6"
              iconBg="#dbeafe"
              showBorder={false}
            />
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-red-500 py-4 rounded-2xl mb-6 flex-row items-center justify-center shadow-md"
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={22} color="#ffffff" />
            <Text className="text-white text-center font-bold text-base ml-2">
              Logout
            </Text>
          </TouchableOpacity>

          {/* App Version */}
          <Text className="text-center text-slate-400 text-xs mb-4">
            Guardian App v1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- COMPONENTS -------------------- */

type QuickActionProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  onPress: () => void;
};

const QuickAction = ({
  label,
  icon,
  color,
  bgColor,
  onPress,
}: QuickActionProps) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex-1 items-center bg-white py-6 rounded-2xl mx-1 border border-gray-100"
    style={{
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    }}
    activeOpacity={0.7}
  >
    <View
      className="w-12 h-12 rounded-xl items-center justify-center mb-2"
      style={{ backgroundColor: bgColor }}
    >
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text className="text-sm font-semibold text-slate-700">{label}</Text>
  </TouchableOpacity>
);

type MenuItemProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  showBorder?: boolean;
};

const MenuItem = ({
  label,
  icon,
  iconColor,
  iconBg,
  showBorder = true,
}: MenuItemProps) => (
  <TouchableOpacity
    className={`flex-row items-center justify-between py-4 ${showBorder ? "border-b border-gray-100" : ""}`}
    activeOpacity={0.7}
  >
    <View className="flex-row items-center flex-1">
      <View
        className="w-10 h-10 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: iconBg }}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text className="text-base text-slate-800 font-medium">{label}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
  </TouchableOpacity>
);
