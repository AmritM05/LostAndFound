"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, LoaderCircle } from "lucide-react";
import Brand from "../Brand";
import { request } from "../../services/apiClient";
export default function AdminLogin() {
  const router = useRouter(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget,
      d = new FormData(form);
    try {
      await request("/api/admin/session/", {
        method: "POST",
        body: JSON.stringify({
          email: d.get("email"),
          password: d.get("password"),
        }),
      });
      router.replace("/admin/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      form.reset();
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Brand />
        <div className="auth-heading">
          <span className="eyebrow">CAMPUS STAFF · DEMO</span>
          <h1>Admin Portal</h1>
          <p>Sign in to manage campus lost and found.</p>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1000}
            />
          </label>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <button className="button" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <ShieldCheck size={16} />
            )}
            Staff sign in
            <ArrowRight size={16} />
          </button>
        </form>
        <p className="auth-privacy">
          Authorized campus staff only. Private reports and photographs stay
          within Magpie.
        </p>
        <a className="auth-back" href="/login/">
          Student sign in
        </a>
      </div>
    </main>
  );
}
