import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Chat from "./Chat";

const Index = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-2xl gemini-bg-gradient animate-pulse" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <Chat />;
};

export default Index;
