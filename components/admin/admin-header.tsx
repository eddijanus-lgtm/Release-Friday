import Link from "next/link";

export function AdminHeader({ email }: { email?: string }) {
  return (
    <>
      <header className="adminHeader">
        <Link href="/" className="adminWordmark" aria-label="Zurück zu Release Friday">
          RELEASE<br />FRIDAY
        </Link>
        <div className="adminIdentity">
          <span>PRIVATE EDITOR</span>
          <strong>{email ?? "ADMIN ACCESS"}</strong>
        </div>
      </header>
      <div className="adminTape">MANUAL DROP DESK · COVER + DATA · PUBLISH SECURELY</div>
    </>
  );
}
