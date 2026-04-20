import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { Geolocation } from "@capacitor/geolocation";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Network } from "@capacitor/network";
import { Clipboard } from "@capacitor/clipboard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

const DEVICE_ID_KEY = "alsa_device_id";

/**
 * Phone-side agent. Only runs on native (Capacitor) builds.
 * Registers the device and listens for commands via Supabase Realtime.
 */
export function useDeviceAgent() {
  const { user } = useAuth();
  const deviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      try {
        const info = await Device.getInfo();
        const stored = localStorage.getItem(DEVICE_ID_KEY);

        // Register or refresh device
        let deviceId: string | null = stored;
        if (deviceId) {
          const { error } = await (supabase.from("devices") as any)
            .update({
              is_online: true,
              last_seen: new Date().toISOString(),
              platform: info.platform,
              model: info.model,
            })
            .eq("id", deviceId)
            .eq("user_id", user.id);
          if (error) deviceId = null;
        }
        if (!deviceId) {
          const { data, error } = await (supabase.from("devices") as any)
            .insert({
              user_id: user.id,
              device_name: `${info.manufacturer || "My"} ${info.model || "Phone"}`.trim(),
              platform: info.platform,
              model: info.model,
              is_online: true,
              last_seen: new Date().toISOString(),
            })
            .select()
            .single();
          if (error || !data) {
            console.error("device register failed", error);
            return;
          }
          deviceId = data.id as string;
          localStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
        if (cancelled) return;
        deviceIdRef.current = deviceId;

        // Request notification permission early (others requested on demand)
        try {
          await LocalNotifications.requestPermissions();
        } catch {}

        // Heartbeat: mark online every 30s
        heartbeat = setInterval(async () => {
          if (!deviceIdRef.current) return;
          await (supabase.from("devices") as any)
            .update({ is_online: true, last_seen: new Date().toISOString() })
            .eq("id", deviceIdRef.current);
        }, 30000);

        // Pick up any pending commands left while offline
        const { data: pending } = await (supabase.from("device_commands") as any)
          .select("*")
          .eq("device_id", deviceId)
          .eq("status", "pending");
        for (const cmd of pending || []) {
          handleCommand(cmd);
        }

        // Realtime: new commands
        channel = supabase
          .channel(`device-cmd-${deviceId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "device_commands",
              filter: `device_id=eq.${deviceId}`,
            },
            (payload) => handleCommand(payload.new),
          )
          .subscribe();
      } catch (e) {
        console.error("device agent init failed", e);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      if (channel) supabase.removeChannel(channel);
      if (deviceIdRef.current) {
        void (supabase.from("devices") as any)
          .update({ is_online: false })
          .eq("id", deviceIdRef.current);
      }
    };
  }, [user]);
}

async function handleCommand(cmd: any) {
  try {
    let result: any = {};
    switch (cmd.command) {
      case "location": {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
        });
        result = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        break;
      }
      case "notify": {
        const { title = "Alsa AI", body = "" } = cmd.payload || {};
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 1e9),
              title,
              body,
              schedule: { at: new Date(Date.now() + 500) },
            },
          ],
        });
        result = { delivered: true };
        break;
      }
      case "vibrate": {
        await Haptics.impact({ style: ImpactStyle.Heavy });
        result = { vibrated: true };
        break;
      }
      case "photo": {
        const source = cmd.payload?.source === "front" ? CameraSource.Camera : CameraSource.Camera;
        const photo = await Camera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source,
        });
        result = { dataUrl: photo.dataUrl, format: photo.format };
        break;
      }
      case "device_info": {
        const info = await Device.getInfo();
        const battery = await Device.getBatteryInfo();
        result = { ...info, ...battery };
        break;
      }
      case "network": {
        const status = await Network.getStatus();
        result = status;
        break;
      }
      case "clipboard_write": {
        await Clipboard.write({ string: cmd.payload?.text || "" });
        result = { copied: true };
        break;
      }
      case "clipboard_read": {
        const v = await Clipboard.read();
        result = { value: v.value };
        break;
      }
      default:
        throw new Error(`Unknown command: ${cmd.command}`);
    }

    await (supabase.from("device_commands") as any)
      .update({
        status: "done",
        result,
        completed_at: new Date().toISOString(),
      })
      .eq("id", cmd.id);
  } catch (e: any) {
    console.error("command failed", cmd.command, e);
    await (supabase.from("device_commands") as any)
      .update({
        status: "failed",
        error: e?.message || String(e),
        completed_at: new Date().toISOString(),
      })
      .eq("id", cmd.id);
    toast.error(`Command failed: ${cmd.command}`);
  }
}
