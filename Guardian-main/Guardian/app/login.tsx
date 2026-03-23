import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../firebase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async () => {
    try {
      setError("");
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // router.replace("/(tabs)");
    } catch (error) {
      const err = error as Error;
      setError(err.message);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* 🔷 Banner Image */}
      <Image
        source={require("../assets/images/guardian_banner1.png")}
        className="w-full h-[55%] absolute top-0 left-0"
        resizeMode="cover"
      />

      {/* 🟨 White Rounded Panel */}
      <View className="absolute top-[50%] w-full h-[65%] bg-white rounded-t-[40px] px-6 pt-10 shadow-lg">
        {/* 🟢 Welcome Message */}
        <Text className="text-center text-2xl font-bold text-[#023047]">
          Welcome to Guardian
        </Text>
        <Text className="text-center text-sm text-gray-500 mt-1">
          The fastest and safest way to detect hazards
        </Text>

        {/* 🔹 Divider with Center Text */}
        <View className="flex-row items-center my-6">
          <View className="flex-1 h-[1px] bg-gray-300" />
          <Text className="px-3 text-[#023047] font-semibold">
            {isSignup ? "Sign Up" : "Log in"}
          </Text>
          <View className="flex-1 h-[1px] bg-gray-300" />
        </View>

        {/* 📧 Email Input */}
        <View className="border border-gray-300 rounded-lg px-3 py-2 mb-4">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            className="text-black"
          />
        </View>

        {/* 🔒 Password Input */}
        <View className="border border-gray-300 rounded-lg px-3 py-2 mb-1 flex-row items-center justify-between">
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry={!showPassword}
            className="flex-1 text-black pr-2"
            autoCapitalize="none"
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
          >
            <Text className="text-sm text-gray-500 font-medium">
              {showPassword ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ⚠️ Error Message */}
        {error !== "" && (
          <Text className="text-red-500 text-xs text-center mt-2">{error}</Text>
        )}

        {/* ❓ Forgot Password
        <View className="flex-row justify-end mt-2 mb-6">
          <TouchableOpacity>
            <Text className="text-xs text-red-500 font-semibold">
              Forgot Password?
            </Text>
          </TouchableOpacity>
        </View> */}

        {/* ✅ Login / Signup Button */}
        <TouchableOpacity
          onPress={handleAuth}
          className="bg-[#00BFA6] py-3 rounded-lg mb-4 mt-6"
        >
          <Text className="text-center text-white font-bold text-base">
            {isSignup ? "Create Account" : "Verify & Login"}
          </Text>
        </TouchableOpacity>

        {/* 🔁 Toggle Link */}
        <View className="flex-row justify-center mt-2">
          <Text className="text-sm text-gray-600">
            {isSignup ? "Already have an account? " : "Don't have an account? "}
          </Text>
          <TouchableOpacity onPress={() => setIsSignup(!isSignup)}>
            <Text className="text-red-500 font-semibold">
              {isSignup ? "Login" : "Sign up"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 🆘 Support Message */}
        {/* <View className="mt-6 items-center">
          <Text className="text-xs text-gray-400">
            Need help?{" "}
            <Text className="underline text-black">Contact support</Text>
          </Text>
        </View> */}
      </View>
    </KeyboardAvoidingView>
  );
}
