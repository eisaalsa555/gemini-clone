-- Devices table: registered phones
CREATE TABLE public.devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_name TEXT NOT NULL DEFAULT 'My Phone',
  platform TEXT,
  model TEXT,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_online BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own devices" ON public.devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own devices" ON public.devices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own devices" ON public.devices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own devices" ON public.devices FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Device commands: web → phone instruction queue
CREATE TABLE public.device_commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own commands" ON public.device_commands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own commands" ON public.device_commands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own commands" ON public.device_commands FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own commands" ON public.device_commands FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_device_commands_device_status ON public.device_commands(device_id, status);
CREATE INDEX idx_device_commands_user ON public.device_commands(user_id, created_at DESC);

-- Enable realtime
ALTER TABLE public.devices REPLICA IDENTITY FULL;
ALTER TABLE public.device_commands REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_commands;