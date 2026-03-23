import { View, Text, Image, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { router } from "expo-router";
import LottieView from "lottie-react-native";

export default function Welcome() {
  return (
    <View className="flex-1 bg-white relative">
      {/* 🔴 Banner image on top */}
      <Image
        source={require("../assets/images/banner3.jpg")}
        className="w-full h-[38%]"
        resizeMode="cover"
        style={{
          zIndex: 2,
          position: "absolute",
          top: 0,
        }}
      />

      {/* ⚪ White curved section */}
      <View
        className="absolute top-[30%] w-full h-[60%] bg-white px-6"
        style={{ zIndex: 1 }}
      >
        {/* 🎞️ Lottie animation */}
        <LottieView
          source={require("../assets/images/welcome.json")} // 👈 your Lottie file
          autoPlay
          loop
          style={{
            width: 300,
            height: 300,
            alignSelf: "center",
            marginBottom: 0,
          }}
        />

        <View>
          <Text
            className="text-4xl font-bold font-mono"
            style={{ color: "#023047" }}
          >
            Welcome
          </Text>
          <Text className="text-gray-600 mt-3 text-base">
            Welcome to Guardian – your smart assistant{"\n"}for safe travel and
            real-time risk alerts.
          </Text>
        </View>

        {/* 🟠 Continue button bottom right */}
        <View className="absolute bottom-0 right-6 flex-row items-center space-x-2">
          <Text className="text-gray-700 font-semibold text-xl mr-3">
            Continue
          </Text>

          <TouchableOpacity
            onPress={() => router.push("/login")}
            className="bg-[#023047] w-12 h-12 rounded-full items-center justify-center shadow-md"
          >
            <Icon name="arrow-right" size={20} color="#36ffea" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
