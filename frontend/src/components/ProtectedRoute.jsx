import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/auth-context.js";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading" role="status">
        <span className="spinner" aria-hidden="true" />
        Loading your workspace…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
