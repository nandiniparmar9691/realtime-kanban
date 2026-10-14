import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/auth-context.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  function validate() {
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      return "Please fill in all fields.";
    }
    if (!EMAIL_RE.test(email.trim())) {
      return "Please enter a valid email address.";
    }
    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to create your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-brand">FlowBoard</span>
          <h1>Create your account</h1>
          <p>Start collaborating with your team in seconds.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <label className="auth-field">
            <span>Full name</span>
            <input
              type="text"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jordan Lee"
              autoComplete="name"
              maxLength={80}
              required
            />
          </label>

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              required
            />
          </label>

          <label className="auth-field">
            <span>Confirm password</span>
            <input
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              required
            />
          </label>

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
