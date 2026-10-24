"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, HardDrive, LoaderCircle } from "lucide-react";
import Brand from "./Brand";
import { campus } from "../lib/campus";
import { getProfile, signIn } from "../services/sessionService";
export default function AuthForm({ signup = false }: { signup?: boolean }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((user) => {
        if (user && !cancelled) router.replace("/student/overview/");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await signIn(
        String(form.get("email") || ""),
        String(form.get("name") || ""),
      );
      router.push("/student/overview/");
    } catch (error) {
      setError((error as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Brand />
        <div className="auth-heading">
          <span className="eyebrow">CAMPUS LOST & FOUND · DEMO</span>
          <h1>{signup ? "Get started with Magpie" : "Welcome to Magpie"}</h1>
          <p>Enter your email to open the Student Portal.</p>
        </div>
        <form onSubmit={submit} className="form-stack">
          <label>
            Name (optional)
            <input
              name="name"
              autoComplete="name"
              maxLength={100}
              placeholder="Your name"
            />
          </label>
          <label>
            Email address
            <input
              name="email"
              autoComplete="email"
              type="email"
              required
              placeholder="you@example.com"
            />
          </label>
          {error && (
            <div role="alert" className="alert error">
              {error}
            </div>
          )}
          <button className="button" disabled={busy}>
            {busy && <LoaderCircle size={17} className="spin" />}Continue
            <ArrowRight size={16} />
          </button>
        </form>
        <div className="auth-privacy">
          <HardDrive size={16} />
          <span>
            Hackathon demo · No password or email verification. Anyone who knows
            an email can enter as that user. Use sample information.
          </span>
        </div>
        <Link className="auth-back" href="/student/search/">
          Explore Magpie
          <ArrowRight size={13} />
        </Link>
      </div>
      <p className="auth-footer">Magpie · {campus.name}</p>
    </main>
  );
}
