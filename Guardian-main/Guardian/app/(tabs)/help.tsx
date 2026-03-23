import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

const faqs = [
  {
    question: "How do I connect my drone?",
    answer:
      "Make sure Bluetooth and WiFi are enabled. Open the Guardian app and tap on 'Drone View.' Your drone should appear automatically in the available devices list.",
    icon: "airplane",
  },
  {
    question: "What video formats can I upload?",
    answer:
      "Guardian supports .mp4, .mov, and .avi formats up to 500MB in size. For best results, use 1080p resolution at 30fps.",
    icon: "videocam",
  },
  {
    question: "How do I know if the drone is connected?",
    answer:
      "You'll see a green 'Connected' status indicator under Drone View. If not connected, check your drone's battery and reconnect.",
    icon: "checkmark-circle",
  },
  {
    question: "What is done with my uploaded video?",
    answer:
      "The video is analyzed by our AI system for safety hazards including potholes, landslides, and road accidents. Processing typically takes 2-5 minutes.",
    icon: "shield-checkmark",
  },
  {
    question: "Is my data safe with Guardian?",
    answer:
      "Absolutely! We use end-to-end encryption for all uploads and do not share your data with third parties. Your privacy is our priority.",
    icon: "lock-closed",
  },
];

export default function HelpScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-teal-500 px-6 pt-4 pb-2 rounded-b-3xl shadow-sm  ">
        <View className="flex-row items-center justify-center mb-2">
          <View className="bg-teal-100 p-3 rounded-full mr-3">
            <Ionicons name="help-circle" size={32} color="#14b8a6" />
          </View>
          <Text className="text-white text-3xl font-bold">Help & Support</Text>
        </View>
      </View>

      <View className="px-5 py-6">
        {/* FAQ Items */}
        {faqs.map((item, index) => (
          <View
            key={index}
            className="bg-white rounded-2xl mb-3 border border-gray-100 overflow-hidden"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <TouchableOpacity
              className="p-5"
              activeOpacity={0.7}
              onPress={() => setOpenIndex(openIndex === index ? null : index)}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 mr-3">
                  <View className="bg-teal-50 p-2.5 rounded-full mr-3">
                    <Ionicons
                      name={item.icon as any}
                      size={20}
                      color="#14b8a6"
                    />
                  </View>
                  <Text className="text-slate-800 text-base font-semibold flex-1">
                    {item.question}
                  </Text>
                </View>
                <View
                  className={`${
                    openIndex === index ? "bg-teal-500" : "bg-gray-100"
                  } p-1.5 rounded-full`}
                >
                  <Ionicons
                    name={openIndex === index ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={openIndex === index ? "#ffffff" : "#64748b"}
                  />
                </View>
              </View>

              {openIndex === index && (
                <View className="mt-4 pt-4 border-t border-gray-100">
                  <Text className="text-slate-600 text-sm leading-6">
                    {item.answer}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        ))}

        {/* Contact Support Section */}
        <View className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-3xl ">
          <View className="items-center">
            <View className="bg-white/20 p-2 rounded-full mb-2">
              <Ionicons name="headset" size={32} color="#14b8a6" />
            </View>
            <Text className="text-black text-xl font-bold mb-2 text-center">
              Still Need Help?
            </Text>
            <Text className="text-black text-center text-sm mb-4">
              Our Guardian AI is here to assist you 24/7
            </Text>

            <TouchableOpacity
              className="bg-white px-8 py-4 rounded-full flex-row items-center shadow-lg"
              activeOpacity={0.8}
              onPress={() => router.push("/chat")}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="#14b8a6" />
              <Text className="ml-2 text-base font-bold text-teal-600">
                Chat with Guardian AI
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom spacing */}
        <View className="h-4"></View>
      </View>
    </ScrollView>
  );
}
