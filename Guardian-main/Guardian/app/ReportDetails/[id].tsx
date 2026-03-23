import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Report } from "../(tabs)/reports";
import { db } from "../../firebase";

// Type for hazard information
type HazardInfo = {
  name: string;
  icon: "warning" | "triangle" | "car";
  detected: boolean;
  count: number;
  color: string;
  bgColor: string;
};

export default function ReportDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchReport = async () => {
      try {
        const docRef = doc(db, "reports", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setReport({ id: docSnap.id, ...docSnap.data() } as Report);
        } else {
          console.warn("No report found with id:", id);
        }
      } catch (error) {
        console.error("Error fetching report:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#14f0c9" />
        <Text className="text-slate-600 mt-4 text-lg">Loading report...</Text>
      </View>
    );
  }

  if (!report) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center p-4">
        <Ionicons name="document-outline" size={64} color="#cbd5e1" />
        <Text className="text-slate-500 text-xl mt-4 text-center">
          Report not found
        </Text>
        <Text className="text-slate-400 text-center mt-2">
          The requested report could not be loaded
        </Text>
      </View>
    );
  }

  const date = new Date(report.timestamp);
  const formattedDate = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Risk score color and label logic
  const getRiskInfo = (score: number) => {
    if (score < 10)
      return {
        color: "bg-green-500",
        label: "Low",
        textColor: "text-green-600",
      };
    if (score < 20)
      return {
        color: "bg-yellow-500",
        label: "Medium",
        textColor: "text-yellow-600",
      };
    return { color: "bg-red-500", label: "High", textColor: "text-red-600" };
  };

  const riskInfo = getRiskInfo(report.risk_score || 0);

  // Hazard detection logic with proper typing and counts
  const hazards: HazardInfo[] = [
    {
      name: "Pothole",
      icon: "warning",
      count: report.pothole_unique || 0,
      detected: (report.pothole_unique || 0) > 0,
      color: "text-orange-500",
      bgColor: "bg-orange-50",
    },
    {
      name: "Landslide",
      icon: "triangle",
      count: report.landslide_unique || 0,
      detected: (report.landslide_unique || 0) > 0,
      color: "text-red-500",
      bgColor: "bg-red-50",
    },
    {
      name: "Road Accident",
      icon: "car",
      count: report.accident_unique || 0,
      detected: (report.accident_unique || 0) > 0,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className=" px-6 py-8 shadow-lg">
        <Text className="text-black text-3xl font-bold text-center mb-3">
          Hazard Detection Report
        </Text>
        <View className="flex-row items-center justify-center bg-white/20 rounded-full px-4 py-2 self-center">
          <Ionicons name="time-outline" size={16} color="#ffffff" />
          <Text className="text-black ml-2 font-medium">
            {formattedDate} • {formattedTime}
          </Text>
        </View>
      </View>

      <View className="px-5 py-6">
        {/* Risk Score Card */}
        <View className="bg-white rounded-3xl p-6 shadow-md mb-5 border border-gray-100">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-slate-500 text-sm font-medium mb-1">
                Overall Risk Score
              </Text>
              <Text className={`text-5xl font-bold ${riskInfo.textColor}`}>
                {report.risk_score?.toFixed(1) || "0.0"}
              </Text>
            </View>
            <View className="items-center">
              <View
                className={`${riskInfo.color} w-20 h-20 rounded-full items-center justify-center shadow-lg`}
              >
                <Ionicons name="shield-checkmark" size={36} color="#ffffff" />
              </View>
              <Text className={`${riskInfo.textColor} font-bold text-sm mt-2`}>
                {riskInfo.label} Risk
              </Text>
            </View>
          </View>
        </View>

        {/* Hazards Detected */}
        <View className="bg-white rounded-3xl p-6 shadow-md mb-5 border border-gray-100">
          <Text className="text-slate-700 text-lg font-bold mb-4">
            Hazards Detected
          </Text>
          {hazards.map((hazard, index) => (
            <View
              key={hazard.name}
              className={`flex-row items-center justify-between py-4 ${
                index !== hazards.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <View className="flex-row items-center flex-1">
                <View className={`${hazard.bgColor} p-3 rounded-full mr-3`}>
                  <Ionicons
                    name={hazard.icon as any}
                    size={20}
                    color={hazard.color.replace("text-", "#")}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-700 text-base font-medium">
                    {hazard.name}
                  </Text>
                  {hazard.detected && (
                    <Text className="text-slate-500 text-xs mt-0.5">
                      {hazard.count}{" "}
                      {hazard.count === 1 ? "instance" : "instances"} detected
                    </Text>
                  )}
                </View>
              </View>
              {hazard.detected ? (
                <View className="flex-row items-center">
                  <View className="bg-teal-100 px-3 py-1.5 rounded-full mr-2">
                    <Text className="text-teal-700 font-bold text-sm">
                      {hazard.count}
                    </Text>
                  </View>
                  <View className="bg-teal-500 p-2 rounded-full">
                    <Ionicons name="checkmark" size={20} color="#ffffff" />
                  </View>
                </View>
              ) : (
                <View className="bg-gray-200 p-2 rounded-full">
                  <Ionicons name="close" size={20} color="#94a3b8" />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Processing Stats */}
        <View className="bg-white rounded-3xl p-6 shadow-md mb-5 border border-gray-100">
          <Text className="text-slate-700 text-lg font-bold mb-4">
            Processing Details
          </Text>

          <View className="flex-row mb-4">
            <View className="flex-1 bg-blue-50 rounded-2xl p-4 mr-2">
              <View className="flex-row items-center mb-2">
                <Ionicons name="film-outline" size={18} color="#3b82f6" />
                <Text className="text-slate-600 text-xs ml-2 font-medium">
                  Total Frames
                </Text>
              </View>
              <Text className="text-blue-600 text-3xl font-bold">
                {report.total_frames || 0}
              </Text>
            </View>

            <View className="flex-1 bg-teal-50 rounded-2xl p-4 ml-2">
              <View className="flex-row items-center mb-2">
                <Ionicons
                  name="checkmark-done-outline"
                  size={18}
                  color="#14b8a6"
                />
                <Text className="text-slate-600 text-xs ml-2 font-medium">
                  Processed
                </Text>
              </View>
              <Text className="text-teal-600 text-3xl font-bold">
                {report.processed_frames || 0}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View className="bg-gray-100 h-3 rounded-full overflow-hidden">
            <View
              className="bg-teal-500 h-full rounded-full"
              style={{
                width: `${((report.processed_frames || 0) / (report.total_frames || 1)) * 100}%`,
              }}
            />
          </View>
          <Text className="text-slate-500 text-xs text-center mt-2">
            {(
              ((report.processed_frames || 0) / (report.total_frames || 1)) *
              100
            ).toFixed(1)}
            % Complete
          </Text>
        </View>

        {/* Bottom spacing */}
        <View className="h-4"></View>
      </View>
    </ScrollView>
  );
}
