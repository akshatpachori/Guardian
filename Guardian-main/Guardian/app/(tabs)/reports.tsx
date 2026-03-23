import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import { db } from "../../firebase";

// Report type
export type Report = {
  id: string;
  timestamp: string | number | Date;
  video_id?: string;
  hazard_detected?: string;
  risk_score?: number;
  total_unique_potholes?: number;
  pothole_unique?: number;
  landslide_unique?: number;
  accident_unique?: number;
  total_frames?: number;
  processed_frames?: number;
};

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchReports = async () => {
    try {
      const snapshot = await getDocs(collection(db, "reports"));
      const data: Report[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Report[];

      data.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setReports(data);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const getRiskColor = (score?: number) => {
    if (!score) return "bg-gray-100 text-gray-600";
    if (score < 10) return "bg-green-100 text-green-700";
    if (score < 20) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  const getHazardIcons = (item: Report) => {
    const icons: { name: any; color: string; bg: string }[] = [];
    if ((item.pothole_unique || 0) > 0) {
      icons.push({ name: "warning" as any, color: "#ea580c", bg: "#ffedd5" });
    }
    if ((item.landslide_unique || 0) > 0) {
      icons.push({ name: "triangle" as any, color: "#dc2626", bg: "#fee2e2" });
    }
    if ((item.accident_unique || 0) > 0) {
      icons.push({ name: "car" as any, color: "#9333ea", bg: "#f3e8ff" });
    }
    return icons;
  };

  const renderItem = ({ item }: { item: Report }) => {
    const date = new Date(item.timestamp);
    const formattedDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const formattedTime = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const hazardIcons = getHazardIcons(item);
    const riskColorClass = getRiskColor(item.risk_score);

    return (
      <TouchableOpacity
        className="bg-white rounded-3xl mx-4 mb-4 border border-gray-100"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 2,
        }}
        activeOpacity={0.7}
        onPress={() => {
          router.push({
            pathname: "/ReportDetails/[id]",
            params: { id: item.id },
          });
        }}
      >
        <View className="p-5">
          {/* Header Row */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center flex-1">
              <View className="bg-teal-500 p-2.5 rounded-full mr-3">
                <Ionicons name="shield-checkmark" size={20} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-slate-800 text-base font-bold">
                  Hazard Report
                </Text>
                <Text className="text-slate-500 text-xs mt-0.5">
                  {formattedDate} • {formattedTime}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
          </View>

          {/* Hazard Icons Row */}
          {hazardIcons.length > 0 && (
            <View className="flex-row items-center mb-3">
              <Text className="text-slate-600 text-xs font-medium mr-2">
                Detected:
              </Text>
              <View className="flex-row">
                {hazardIcons.map((icon, index) => (
                  <View
                    key={index}
                    className="p-2 rounded-full mr-1.5"
                    style={{ backgroundColor: icon.bg }}
                  >
                    <Ionicons name={icon.name} size={14} color={icon.color} />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Stats Row */}
          <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
            {/* Risk Score */}
            <View
              className={`px-3 py-2 rounded-xl ${riskColorClass.split(" ")[0]}`}
            >
              <Text
                className={`text-xs font-bold ${riskColorClass.split(" ")[1]}`}
              >
                Risk: {item.risk_score?.toFixed(1) || "N/A"}
              </Text>
            </View>

            {/* Frames Progress */}
            {item.total_frames && (
              <View className="bg-blue-50 px-3 py-2 rounded-xl">
                <Text className="text-blue-700 text-xs font-bold">
                  {item.processed_frames || 0}/{item.total_frames} frames
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#14b8a6" />
        <Text className="text-slate-600 mt-4 text-lg">Loading reports...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Modern Header with Refresh Button */}
      <View className="bg-white px-6 pt-6 pb-4 shadow-sm">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-1">
            <Text className="text-3xl font-extrabold text-slate-900">
              Reports
            </Text>
            <View className="flex-row items-center mt-2">
              <View className="w-2 h-2 rounded-full bg-teal-500 mr-2" />
              <Text className="text-slate-500 text-sm font-medium">
                {reports.length} {reports.length === 1 ? "report" : "reports"}
              </Text>
            </View>
          </View>

          {/* Refresh Button */}
          <TouchableOpacity
            className="bg-teal-500 w-12 h-12 rounded-2xl items-center justify-center shadow-md shadow-teal-200"
            activeOpacity={0.7}
            onPress={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="refresh" size={24} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#14b8a6"]}
            tintColor="#14b8a6"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20 px-8">
            <View className="w-24 h-24 bg-teal-100 rounded-full items-center justify-center mb-4">
              <Ionicons
                name="document-text-outline"
                size={48}
                color="#14b8a6"
              />
            </View>
            <Text className="text-slate-700 text-xl font-bold text-center">
              No Reports Yet
            </Text>
            <Text className="text-slate-500 text-center mt-2 leading-5">
              Hazard detection reports will appear here once processing is
              complete
            </Text>

            {/* Refresh Suggestion */}
            <TouchableOpacity
              className="bg-teal-500 px-6 py-3 rounded-full mt-6 flex-row items-center"
              activeOpacity={0.7}
              onPress={onRefresh}
            >
              <Ionicons name="refresh" size={18} color="white" />
              <Text className="text-white font-semibold ml-2">Refresh</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}
