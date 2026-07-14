import type { FormEvent } from "react";

type AdminLoginFormProps = {
  configured: boolean;
  busy: boolean;
  error?: string;
  onSubmit: (email: string, password: string) => Promise<void>;
};

export function AdminLoginForm({ configured, busy, error, onSubmit }: AdminLoginFormProps) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onSubmit(String(form.get("email") ?? "").trim(), String(form.get("password") ?? ""));
  }

  return (
    <div className="adminLoginBody">
      <p className="adminSectionLabel">SECURE ACCESS</p>
      <h1 className="adminTitle">ADMIN<br />LOGIN</h1>
      <p className="adminIntro">Nur freigeschaltete Redakteure können neue Releases anlegen oder veröffentlichen.</p>

      {!configured ? (
        <div className="adminNotice" role="status">
          <strong>BACKEND NOCH NICHT VERBUNDEN</strong>
          <span>Nach dem Eintragen der Supabase-Schlüssel wird dieses Login automatisch aktiv.</span>
        </div>
      ) : null}

      <form className="adminLoginForm" onSubmit={handleSubmit}>
        <label className="adminField">
          <span>E-MAIL</span>
          <input name="email" type="email" inputMode="email" autoComplete="username" required disabled={!configured || busy} placeholder="admin@release-friday.de" />
        </label>
        <label className="adminField">
          <span>PASSWORT</span>
          <input name="password" type="password" autoComplete="current-password" required disabled={!configured || busy} placeholder="••••••••••••" />
        </label>
        {error ? <p className="adminError" role="alert">{error}</p> : null}
        <button className="adminPrimaryButton" type="submit" disabled={!configured || busy}>
          {busy ? "LOGIN WIRD GEPRÜFT …" : "EINLOGGEN →"}
        </button>
      </form>
      <p className="adminSecurityNote">Keine öffentliche Registrierung · Zugriff wird zusätzlich in der Datenbank geprüft.</p>
    </div>
  );
}
