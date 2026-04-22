import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.alsaai",
  appName: "Alsa AI",
  webDir: "dist",
  server: {
    url: "https://gem-control-hub.lovable.app/",
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
