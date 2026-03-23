// Home.tsx
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

/**
 * Guardian App - Hazard Detection System
 *
 * Features:
 * 1. Real-time RTSP stream detection
 * 2. Video file upload for analysis
 *
 * Required packages:
 * - npx expo install react-native-webview
 * - npx expo install expo-document-picker
 * - npx expo install expo-screen-orientation
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const BACKEND_BASE = "http://192.168.29.249:8501"; // Real-time stream backend
const UPLOAD_BACKEND = "http://192.168.29.249:8502"; // Video upload backend

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Home() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"drone" | "upload">("drone");

  // Real-time stream states
  const [rtspUrl, setRtspUrl] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  // Upload states
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // ============================================================================
  // REAL-TIME STREAM API CALLS
  // ============================================================================

  const startStream = async (source: string) => {
    const url = `${BACKEND_BASE}/start_stream`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rtsp_url: source }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Failed to start stream: ${resp.status} ${txt}`);
    }
    return resp.json();
  };

  const stopStream = async () => {
    const url = `${BACKEND_BASE}/stop_stream`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Failed to stop stream: ${resp.status} ${txt}`);
    }
    return resp.json();
  };

  // ============================================================================
  // VIDEO UPLOAD API CALL
  // ============================================================================

  const uploadVideo = async (uri: string, fileName: string) => {
    const formData = new FormData();

    // @ts-ignore - FormData accepts file objects
    formData.append("video", {
      uri: uri,
      type: "video/mp4",
      name: fileName,
    });

    const url = `${UPLOAD_BACKEND}/upload_video`;
    const resp = await fetch(url, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Upload failed: ${resp.status} ${txt}`);
    }
    return resp.json();
  };

  // ============================================================================
  // REAL-TIME STREAM HANDLERS
  // ============================================================================

  const handleConnect = async () => {
    const trimmedUrl = rtspUrl.trim();

    if (!trimmedUrl) {
      Alert.alert("Error", "Please enter an RTSP URL or enter 0 for webcam");
      return;
    }

    setConnecting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (trimmedUrl === "0") {
        Alert.alert(
          "Webcam Mode",
          "Server will use webcam for detection. Click Start to begin."
        );
      }

      setIsConnected(true);
      setIsStreaming(false);
    } catch (err) {
      console.error("Connection error:", err);
      Alert.alert("Connection Failed", "Unable to connect. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleStart = async () => {
    if (!isConnected) {
      Alert.alert("Not Connected", "Please connect first.");
      return;
    }

    setConnecting(true);
    try {
      const response = await startStream(rtspUrl.trim());
      console.log("Start stream response:", response);

      // Set stream URL for live video feed
      setStreamUrl(`${BACKEND_BASE}/video_feed`);

      setTimeout(() => {
        setIsStreaming(true);
        setConnecting(false);
      }, 500);
    } catch (err: any) {
      console.error("Start stream error:", err);
      Alert.alert("Start Failed", err.message || "Unknown error occurred");
      setConnecting(false);
    }
  };

  const handleStop = async () => {
    if (!isStreaming) return;

    setConnecting(true);
    try {
      const response = await stopStream();
      console.log("Stop stream response:", response);

      const report = response.report || response;
      const total = report.total_unique_tracked || 0;
      const byLabel = report.by_label || {};

      let summary = `📊 Detection Report\n\n`;
      summary += `Total Hazards Detected: ${total}\n\n`;

      if (Object.keys(byLabel).length > 0) {
        summary += `Breakdown:\n`;
        for (const [label, count] of Object.entries(byLabel)) {
          summary += `• ${label}: ${count}\n`;
        }
      }

      Alert.alert("Session Ended", summary);

      // Reset state
      setIsStreaming(false);
      setStreamUrl(null);

      if (isFullscreen) {
        await exitFullscreen();
      }
    } catch (err: any) {
      console.error("Stop stream error:", err);
      Alert.alert("Stop Failed", err.message || "Unknown error occurred");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (isStreaming) {
      await handleStop();
    }

    setIsConnected(false);
    setIsStreaming(false);
    setStreamUrl(null);
    setRtspUrl("");
  };

  // ============================================================================
  // VIDEO UPLOAD HANDLERS
  // ============================================================================

  const handlePickVideo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "video/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];

      Alert.alert("Upload Video", `Upload ${file.name} for hazard detection?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Upload",
          onPress: () => handleUploadVideo(file.uri, file.name),
        },
      ]);
    } catch (err) {
      console.error("Pick video error:", err);
      Alert.alert("Error", "Failed to pick video file");
    }
  };

  const handleUploadVideo = async (uri: string, fileName: string) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress (fake progress for UI)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await uploadVideo(uri, fileName);

      clearInterval(progressInterval);
      setUploadProgress(100);

      console.log("Upload response:", response);

      const report = response.report || response;

      // --- NEW FIELDS FROM BACKEND ---
      const potholes =
        report.pothole_unique ??
        report.total_unique_potholes ?? // backwards compatibility
        0;
      const landslides = report.landslide_unique ?? 0;
      const accidents = report.accident_unique ?? 0;

      // Total hazards = sum of all three
      let totalHazards = potholes + landslides + accidents;

      // Fallback for older response formats, just in case
      if (totalHazards === 0) {
        totalHazards = report.total_unique_tracked ?? report.total ?? 0;
      }

      // Build breakdown map
      const breakdown: Record<string, number> = {};

      if (potholes > 0) breakdown["Potholes"] = potholes;
      if (landslides > 0) breakdown["Landslides"] = landslides;
      if (accidents > 0) breakdown["Accidents"] = accidents;

      // If backend also sends a generic by_label, merge it in (without overriding)
      if (report.by_label && typeof report.by_label === "object") {
        for (const [label, count] of Object.entries(report.by_label as any)) {
          if (!breakdown[label]) {
            breakdown[label] = Number(count) || 0;
          }
        }
      }

      const hazardDetected = report.hazard_detected ?? "none";
      const riskScore =
        typeof report.risk_score === "number"
          ? report.risk_score.toFixed(2)
          : "0.00";

      // --- SUMMARY MESSAGE ---
      let summary = `📊 Analysis Complete\n\n`;
      summary += `Total Hazards Detected: ${totalHazards}\n`;
      summary += `Primary Hazard: ${hazardDetected}\n`;
      summary += `Overall Risk Score: ${riskScore}\n\n`;

      if (Object.keys(breakdown).length > 0) {
        summary += `Breakdown:\n`;
        for (const [label, count] of Object.entries(breakdown)) {
          summary += `• ${label}: ${count}\n`;
        }
      }

      setTimeout(() => {
        Alert.alert("Upload Successful", summary);
        setUploading(false);
        setUploadProgress(0);
      }, 500);
    } catch (err: any) {
      console.error("Upload error:", err);
      Alert.alert("Upload Failed", err.message || "Unknown error occurred");
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ============================================================================
  // FULLSCREEN HANDLERS
  // ============================================================================

  const enterFullscreen = async () => {
    try {
      if (ScreenOrientation?.lockAsync) {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT
        );
      }
    } catch (e) {
      console.warn("Could not lock orientation:", e);
    } finally {
      setIsFullscreen(true);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (ScreenOrientation?.unlockAsync) {
        await ScreenOrientation.unlockAsync();
      }
    } catch (e) {
      console.warn("Could not unlock orientation:", e);
    } finally {
      setIsFullscreen(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <SafeAreaView className="flex-1 bg-white px-4">
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View className="flex-row justify-between items-center mb-8 mt-6">
        <Text className="text-3xl font-bold" style={{ color: "#023047" }}>
          Guardian
        </Text>
        <Ionicons name="shield-checkmark" size={32} color="#14b8a6" />
      </View>

      {/* Tab Selector */}
      <View className="flex-row space-x-3 mb-6">
        <TouchableOpacity
          className={`flex-1 mr-3 h-24 rounded-2xl items-center justify-center ${
            activeTab === "drone"
              ? "bg-teal-100 border-2 border-teal-400"
              : "bg-slate-100"
          }`}
          activeOpacity={0.7}
          onPress={() => setActiveTab("drone")}
        >
          <Ionicons
            name="videocam-outline"
            size={28}
            color={activeTab === "drone" ? "#14b8a6" : "#64748b"}
          />
          <Text
            className={`mt-2 text-base font-semibold ${
              activeTab === "drone" ? "text-teal-700" : "text-slate-600"
            }`}
          >
            Live Stream
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 h-24 rounded-2xl items-center justify-center ${
            activeTab === "upload"
              ? "bg-teal-100 border-2 border-teal-400"
              : "bg-slate-100"
          }`}
          activeOpacity={0.7}
          onPress={() => setActiveTab("upload")}
        >
          <Ionicons
            name="cloud-upload-outline"
            size={28}
            color={activeTab === "upload" ? "#14b8a6" : "#64748b"}
          />
          <Text
            className={`mt-2 text-base font-semibold ${
              activeTab === "upload" ? "text-teal-700" : "text-slate-600"
            }`}
          >
            Upload Video
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <View className="flex-1">
        {activeTab === "drone" ? (
          // ============================================================================
          // REAL-TIME STREAM TAB
          // ============================================================================
          <View className="flex-1">
            {!isConnected ? (
              // Connection Setup
              <View className="flex-1 justify-center items-center px-4">
                <View className="w-32 h-32 rounded-full bg-teal-50 items-center justify-center mb-8">
                  <Ionicons name="videocam" size={64} color="#14b8a6" />
                </View>

                <Text className="text-xl font-bold text-slate-800 mb-2">
                  Connect to Stream
                </Text>
                <Text className="text-sm text-slate-500 text-center mb-8">
                  Enter RTSP URL or use 0 for webcam
                </Text>

                <View className="w-full mb-6">
                  <TextInput
                    value={rtspUrl}
                    onChangeText={setRtspUrl}
                    placeholder="rtsp://username:password@ip:port/stream"
                    className="w-full h-14 rounded-xl px-4 bg-slate-50 border-2 border-slate-200 text-base"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!connecting}
                    placeholderTextColor="#94a3b8"
                  />
                  <Text className="text-xs text-slate-400 mt-2 ml-2">
                    Tip: Enter 0 to use servers webcam
                  </Text>
                </View>

                <View className="flex-row space-x-3 w-full">
                  <TouchableOpacity
                    className="flex-1 mr-3 h-14 rounded-xl items-center justify-center"
                    style={{ backgroundColor: "#14b8a6" }}
                    onPress={handleConnect}
                    disabled={connecting}
                  >
                    {connecting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text className="text-white font-bold text-base">
                          Connect
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* <TouchableOpacity
                    className="flex-1 h-14 rounded-xl bg-slate-200 items-center justify-center"
                    onPress={() => setRtspUrl("0")}
                  >
                    <Text className="text-slate-700 font-semibold">
                      Use Webcam
                    </Text>
                  </TouchableOpacity> */}
                </View>

                <View className="mt-8 items-center">
                  <View className="flex-row items-center">
                    <FlickerLight color="red" />
                    <Text className="ml-2 text-slate-400">Not Connected</Text>
                  </View>
                </View>
              </View>
            ) : (
              // Stream View
              <View className="flex-1">
                <View className="flex-row items-center justify-center mb-4">
                  <FlickerLight color="#14b8a6" />
                  <Text className="ml-2 text-teal-600 font-semibold">
                    Connected
                  </Text>
                </View>

                {/* Video Container */}
                <View className="h-96 rounded-2xl overflow-hidden bg-slate-900 mb-4">
                  {isStreaming && streamUrl ? (
                    <View className="h-full relative">
                      <WebView
                        source={{ uri: streamUrl }}
                        style={{ flex: 1, backgroundColor: "#000" }}
                        originWhitelist={["*"]}
                        {...(Platform.OS === "android"
                          ? { mixedContentMode: "always" }
                          : {})}
                      />
                      <TouchableOpacity
                        style={styles.fullscreenButton}
                        onPress={enterFullscreen}
                      >
                        <Ionicons name="expand" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View className="h-full items-center justify-center px-6">
                      <Ionicons name="play-circle" size={64} color="#14b8a6" />
                      <Text className="text-white text-lg font-semibold mt-4 text-center">
                        Ready to Start
                      </Text>
                      <Text className="text-slate-400 text-sm mt-2 text-center">
                        {rtspUrl === "0"
                          ? "Server webcam ready"
                          : `Source: ${rtspUrl}`}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Controls */}
                <View className="flex-row justify-center">
                  {!isStreaming ? (
                    <TouchableOpacity
                      className="px-4 mr-3 h-14 rounded-xl items-center justify-center"
                      style={{ backgroundColor: "#14b8a6" }}
                      onPress={handleStart}
                      disabled={connecting}
                    >
                      {connecting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="play" size={20} color="#fff" />
                          <Text className="text-white font-bold ml-2">
                            Start Detection
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      className="px-6 h-14 rounded-xl items-center justify-center mr-3"
                      style={{ backgroundColor: "#f59e0b" }}
                      onPress={handleStop}
                      disabled={connecting}
                    >
                      {connecting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="stop" size={20} color="#fff" />
                          <Text className="text-white font-bold ml-2">
                            Stop & Report
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    className="px-8 h-14 ml-3 rounded-xl bg-red-500 items-center justify-center"
                    onPress={handleDisconnect}
                  >
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text className="text-white font-bold ml-1">
                      Disconnect
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          // ============================================================================
          // VIDEO UPLOAD TAB
          // ============================================================================
          <View className="flex-1 justify-center items-center px-4">
            {!uploading ? (
              <>
                <View className="w-40 h-40 rounded-full bg-teal-50 items-center justify-center mb-8">
                  <Ionicons name="cloud-upload" size={80} color="#14b8a6" />
                </View>

                <Text className="text-2xl font-bold text-slate-800 mb-2">
                  Upload Video
                </Text>
                <Text className="text-base text-slate-500 text-center mb-8">
                  Select a video file for hazard detection analysis
                </Text>

                <TouchableOpacity
                  className="w-full h-16 rounded-xl items-center justify-center"
                  style={{ backgroundColor: "#14b8a6" }}
                  onPress={handlePickVideo}
                >
                  <View className="flex-row items-center">
                    <Ionicons name="folder-open" size={24} color="#fff" />
                    <Text className="text-white font-bold text-lg ml-3">
                      Choose Video File
                    </Text>
                  </View>
                </TouchableOpacity>

                <View className="mt-8 p-4 bg-teal-50 rounded-xl">
                  <Text className="text-sm text-teal-800 text-center">
                    💡 Supported formats: MP4, MOV, AVI
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View className="w-40 h-40 rounded-full bg-teal-50 items-center justify-center mb-8">
                  <ActivityIndicator size="large" color="#14b8a6" />
                </View>

                <Text className="text-2xl font-bold text-slate-800 mb-2">
                  Analyzing Video...
                </Text>
                <Text className="text-base text-slate-500 mb-8">
                  Please wait while we process your video
                </Text>

                <View className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${uploadProgress}%`,
                      backgroundColor: "#14b8a6",
                    }}
                  />
                </View>
                <Text className="text-sm text-slate-600 mt-3">
                  {uploadProgress}% Complete
                </Text>
              </>
            )}
          </View>
        )}
      </View>

      {/* Fullscreen Modal */}
      <Modal
        visible={isFullscreen}
        animationType="slide"
        supportedOrientations={["landscape"]}
        presentationStyle="fullScreen"
        onRequestClose={exitFullscreen}
      >
        <StatusBar hidden={true} />
        <View style={fsStyles.container}>
          {streamUrl ? (
            <WebView
              source={{ uri: streamUrl }}
              style={fsStyles.webview}
              originWhitelist={["*"]}
              {...(Platform.OS === "android"
                ? { mixedContentMode: "always" }
                : {})}
            />
          ) : (
            <View style={fsStyles.noStream}>
              <Ionicons name="alert-circle" size={48} color="#fff" />
              <Text style={fsStyles.noStreamText}>No stream available</Text>
            </View>
          )}

          {/* Top Bar */}
          <View style={fsStyles.topBar}>
            <TouchableOpacity
              onPress={exitFullscreen}
              style={fsStyles.topButton}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={fsStyles.topTitle}>Live Detection</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Bottom Controls */}
          <View style={fsStyles.controls}>
            {!isStreaming ? (
              <TouchableOpacity
                style={[fsStyles.controlButton, { backgroundColor: "#14b8a6" }]}
                onPress={handleStart}
                disabled={connecting}
              >
                {connecting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={fsStyles.controlText}>Start</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[fsStyles.controlButton, { backgroundColor: "#f59e0b" }]}
                onPress={handleStop}
                disabled={connecting}
              >
                <Text style={fsStyles.controlText}>Stop</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================================
// FLICKER LIGHT COMPONENT
// ============================================================================

const FlickerLight = ({ color }: { color: string }) => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: color,
        opacity,
      }}
    />
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  fullscreenButton: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 8,
    zIndex: 10,
  },
});

const fsStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  webview: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
  noStream: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noStreamText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 12,
  },
  topBar: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 12,
    paddingHorizontal: 8,
    zIndex: 20,
  },
  topButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  controls: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  controlButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 120,
    alignItems: "center",
  },
  controlText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
