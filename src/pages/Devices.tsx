import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  MapPin,
  Bell,
  Camera as CameraIcon,
  Vibrate,
  Smartphone,
  Wifi,
  Clipboard as ClipboardIcon,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Device = {
  id: string;
  device_name: string;
  platform: string | null;
  model: string | null;
  is_online: boolean;
  last_seen: string;
};

type Command = {
  id: string;
  command: string;
  status: string;
  result: any;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

const COMMAND_LABELS: Record<string, string> = {
  location: "Location",
  notify: "Notification",
  photo: "Photo",
  vibrate: "Vibrate",
  device_info: "Device info",
  network: "Network",
  clipboard_write: "Copy to clipboard",
  clipboard_read: "Read clipboard",
};

export default function Devices() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifyOpen, setNotifyOpen] = useState<string | null>(null);
  const [notifyTitle, setNotifyTitle] = useState("Alsa AI");
  const [notifyBody, setNotifyBody] = useState("");
  const [clipOpen, setClipOpen] = useState<string | null>(null);
  const [clipText, setClipText] = useState("");

  useEffect(() => {
    if (!user) return;
    void loadAll();

    const ch = supabase
      .channel("devices-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devices" },
        () => loadDevices(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_commands" },
        () => loadCommands(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadDevices = async () => {
    const { data } = await (supabase.from("devices") as any)
      .select("*")
      .order("last_seen", { ascending: false });
    setDevices((data as Device[]) || []);
  };
  const loadCommands = async () => {
    const { data } = await (supabase.from("device_commands") as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setCommands((data as Command[]) || []);
  };
  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadDevices(), loadCommands()]);
    setLoading(false);
  };

  const sendCommand = async (
    deviceId: string,
    command: string,
    payload: Record<string, unknown> = {},
  ) => {
    if (!user) return;
    const { error } = await (supabase.from("device_commands") as any).insert({
      user_id: user.id,
      device_id: deviceId,
      command,
      payload,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Sent: ${COMMAND_LABELS[command] || command}`);
    }
  };

  const isFresh = (lastSeen: string) =>
    Date.now() - new Date(lastSeen).getTime() < 90_000;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button size="icon" variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Devices</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Registered phones
          </h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : devices.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              <Smartphone className="mx-auto mb-2 h-8 w-8 opacity-50" />
              Koi device register nahi hai.
              <br />
              APK install karke open karein → device khud register ho jayega.
            </Card>
          ) : (
            <div className="space-y-3">
              {devices.map((d) => {
                const online = d.is_online && isFresh(d.last_seen);
                return (
                  <Card key={d.id} className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              online ? "bg-green-500" : "bg-muted-foreground/40"
                            }`}
                          />
                          <h3 className="font-semibold">{d.device_name}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {d.platform || "?"} · {d.model || "?"} ·{" "}
                          {online
                            ? "Online"
                            : `Last seen ${formatDistanceToNow(
                                new Date(d.last_seen),
                                { addSuffix: true },
                              )}`}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => sendCommand(d.id, "location")}
                        disabled={!online}
                      >
                        <MapPin className="mr-1 h-4 w-4" /> Location
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setNotifyOpen(d.id);
                          setNotifyBody("");
                        }}
                        disabled={!online}
                      >
                        <Bell className="mr-1 h-4 w-4" /> Notify
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => sendCommand(d.id, "photo")}
                        disabled={!online}
                      >
                        <CameraIcon className="mr-1 h-4 w-4" /> Photo
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => sendCommand(d.id, "vibrate")}
                        disabled={!online}
                      >
                        <Vibrate className="mr-1 h-4 w-4" /> Vibrate
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => sendCommand(d.id, "device_info")}
                        disabled={!online}
                      >
                        <Smartphone className="mr-1 h-4 w-4" /> Info
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => sendCommand(d.id, "network")}
                        disabled={!online}
                      >
                        <Wifi className="mr-1 h-4 w-4" /> Network
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setClipOpen(d.id);
                          setClipText("");
                        }}
                        disabled={!online}
                      >
                        <ClipboardIcon className="mr-1 h-4 w-4" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => sendCommand(d.id, "clipboard_read")}
                        disabled={!online}
                      >
                        <ClipboardIcon className="mr-1 h-4 w-4" /> Read clip
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Recent results
          </h2>
          {commands.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commands yet.</p>
          ) : (
            <div className="space-y-2">
              {commands.map((c) => (
                <Card key={c.id} className="p-3">
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    {c.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : c.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    <span className="font-medium">
                      {COMMAND_LABELS[c.command] || c.command}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  {c.error && (
                    <p className="text-xs text-destructive">{c.error}</p>
                  )}
                  {c.result && <ResultView command={c.command} result={c.result} />}
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Notify dialog */}
      <Dialog open={!!notifyOpen} onOpenChange={(o) => !o && setNotifyOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send notification</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Title"
            value={notifyTitle}
            onChange={(e) => setNotifyTitle(e.target.value)}
          />
          <Textarea
            placeholder="Message"
            value={notifyBody}
            onChange={(e) => setNotifyBody(e.target.value)}
          />
          <DialogFooter>
            <Button
              onClick={async () => {
                if (notifyOpen) {
                  await sendCommand(notifyOpen, "notify", {
                    title: notifyTitle,
                    body: notifyBody,
                  });
                }
                setNotifyOpen(null);
              }}
              disabled={!notifyBody}
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clipboard dialog */}
      <Dialog open={!!clipOpen} onOpenChange={(o) => !o && setClipOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy text to phone</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Text to copy on phone"
            value={clipText}
            onChange={(e) => setClipText(e.target.value)}
          />
          <DialogFooter>
            <Button
              onClick={async () => {
                if (clipOpen) {
                  await sendCommand(clipOpen, "clipboard_write", {
                    text: clipText,
                  });
                }
                setClipOpen(null);
              }}
              disabled={!clipText}
            >
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResultView({ command, result }: { command: string; result: any }) {
  if (command === "location" && result?.latitude) {
    const url = `https://www.google.com/maps?q=${result.latitude},${result.longitude}`;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary underline"
      >
        📍 {result.latitude.toFixed(5)}, {result.longitude.toFixed(5)} (open map)
      </a>
    );
  }
  if (command === "photo" && result?.dataUrl) {
    return (
      <img
        src={result.dataUrl}
        alt="Captured"
        className="mt-2 max-h-64 rounded-md border border-border"
      />
    );
  }
  return (
    <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}
