import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.6054eeebe521490fa32bc1659ebbd093",
  appName: "Alsa AI",
  webDir: "dist",
  server: {
    url: "https://6054eeeb-e521-490f-a32b-c1659ebbd093.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#3B82F6",
    },
  },
};

export default config;
