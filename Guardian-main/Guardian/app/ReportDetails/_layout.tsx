import { Stack } from "expo-router";

export default function ReportDetailsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="[id]"
        options={{
          title: "Report Details",
          headerShown: true,
        }}
      />
    </Stack>
  );
}
