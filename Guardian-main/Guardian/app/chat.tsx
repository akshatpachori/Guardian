import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

const GEMINI_API_KEY = "AIzaSyBa-mPz1-CSr4o7m_V6hu1RFX8xE3NBTHU";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "👋 Welcome to Guardian! How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const prompt = `
You are Guardian's AI assistant. Answer only questions about the Guardian app. If a question is irrelevant or outside Guardian's scope, respond politely that you're limited to app-related queries.

Here's everything about the Guardian app:

Guardian is a **risk detection system for hilly areas**, built using **machine learning** and drone-based media capture.

The app supports two core functionalities:

1. **Drone Live Stream Mode**:
   - A drone is directly connected to the app.
   - The app streams real-time video from the drone.
   - It runs object detection models (like YOLOv8) on the video feed to detect:
     - Landslides
     - Potholes
     - Animal crossings
     - Accidents
   - It generates a **risk analysis report** in real-time.

2. **Manual Video Upload Mode**:
   - Users can upload a **drone-captured video** of a path or route.
   - The app processes the video using the same ML models.
   - It provides a **risk score** and a **risk analysis report** based on the video.

The app ensures safety by detecting hazards early, helping travelers and transportation services avoid dangerous routes in hilly terrains.

If someone asks about this app, drone connection, ML usage, YOLOv8, video uploads, or risk scoring, answer helpfully. For other topics, explain politely that you only support Guardian-related questions.
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt + "\n\nUser: " + input }],
              },
            ],
          }),
        }
      );

      const data = await response.json();
      const aiReply =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        "Sorry, I couldn't understand that.";

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: aiReply,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error("Error contacting Gemini:", error);
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: "Something went wrong. Please try again later.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date?: Date) => {
    if (!date) return "";
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View className={`mb-4 px-4 ${isUser ? "items-end" : "items-start"}`}>
        <View
          className={`rounded-3xl px-5 py-3 max-w-[80%] ${
            isUser
              ? "bg-teal-500 rounded-tr-md"
              : "bg-white border border-gray-200 rounded-tl-md"
          }`}
          style={
            !isUser
              ? {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 2,
                }
              : {}
          }
        >
          {!isUser && (
            <View className="flex-row items-center mb-2">
              <View className="bg-teal-100 p-1.5 rounded-full mr-2">
                <Ionicons name="shield-checkmark" size={14} color="#14b8a6" />
              </View>
              <Text className="text-teal-600 text-xs font-semibold">
                Guardian AI
              </Text>
            </View>
          )}
          <Text
            className={`text-base leading-6 ${
              isUser ? "text-white" : "text-slate-800"
            }`}
          >
            {item.content}
          </Text>
          <Text
            className={`text-xs mt-1 ${
              isUser ? "text-white/70" : "text-slate-400"
            }`}
          >
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header */}
        <View className="bg-white px-5 py-4 border-b border-gray-100 shadow-sm">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 bg-gray-100 p-2 rounded-full"
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#14b8a6" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-slate-900 text-xl font-bold">
                Guardian AI Assistant
              </Text>
              <View className="flex-row items-center mt-1">
                <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                <Text className="text-slate-500 text-xs">Online</Text>
              </View>
            </View>
            <View className="bg-teal-100 p-3 rounded-full">
              <Ionicons name="chatbubbles" size={24} color="#14b8a6" />
            </View>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={{ paddingVertical: 16 }}
          showsVerticalScrollIndicator={false}
          className="flex-1"
        />

        {/* Loading Indicator */}
        {loading && (
          <View className="px-4 pb-2">
            <View className="bg-white border border-gray-200 rounded-3xl rounded-tl-md px-5 py-3 self-start max-w-[80%]">
              <View className="flex-row items-center">
                <View className="bg-teal-100 p-1.5 rounded-full mr-2">
                  <Ionicons name="shield-checkmark" size={14} color="#14b8a6" />
                </View>
                <Text className="text-teal-600 text-xs font-semibold mr-3">
                  Guardian AI
                </Text>
                <ActivityIndicator size="small" color="#14b8a6" />
              </View>
              <Text className="text-slate-500 text-sm mt-2">Typing...</Text>
            </View>
          </View>
        )}

        {/* Input Area */}
        <View className="bg-white px-4 py-3 border-t border-gray-100">
          <View className="flex-row items-end bg-gray-50 rounded-3xl px-4 py-2 border border-gray-200">
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask about Guardian..."
              placeholderTextColor="#94a3b8"
              className="flex-1 text-base text-slate-800 max-h-24 py-2"
              multiline
              style={{ minHeight: 40 }}
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={loading || !input.trim()}
              className={`ml-2 p-2.5 rounded-full ${
                loading || !input.trim() ? "bg-gray-200" : "bg-teal-500"
              }`}
              activeOpacity={0.7}
            >
              <Ionicons
                name="send"
                size={20}
                color={loading || !input.trim() ? "#94a3b8" : "#ffffff"}
              />
            </TouchableOpacity>
          </View>
          <Text className="text-center text-slate-400 text-xs mt-2">
            Powered by Gemini AI
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
