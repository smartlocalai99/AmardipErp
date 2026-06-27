import { getUserFromRequest } from "@/lib/auth";
import { useEffect, useState } from "react";

export async function getServerSideProps({ req }) {
  const user = await getUserFromRequest(req);
  if (!user) return { redirect: { destination: "/Adminlogin", permanent: false } };
  if (user.role !== "superadmin") return { notFound: true };
  return { props: { user } };
}

export default function BoqPermissionsPage() {
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const [permRes, userRes] = await Promise.all([fetch("/api/quotation-permissions"), fetch("/api/users")]);
    const permData = await permRes.json();
    const userData = await userRes.json();
    if (permData.success) setAdmins(permData.admins || []);
    if (userData.success) setUsers((userData.users || []).filter((u) => ["superadmin", "admin", "manager"].includes(u.role)));
  }

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, []);

  async function addAdmin() {
    const res = await fetch("/api/quotation-permissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId }) });
    const data = await res.json();
    if (!res.ok || !data.success) return setError(data.message || "Failed to add BOQ admin");
    setSelectedUserId("");
    await load();
  }

  async function removeAdmin(userId) {
    const res = await fetch("/api/quotation-permissions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    const data = await res.json();
    if (!res.ok || !data.success) return setError(data.message || "Failed to remove BOQ admin");
    await load();
  }

  return (
    <main className="min-h-screen bg-[#eef2f7] p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-3xl bg-[#0a649d] p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Superadmin</p>
          <h1 className="mt-2 text-2xl font-black">BOQ Admin Permissions</h1>
          <p className="text-xs text-white/75">Maximum 6 BOQ admins reached at {admins.length}/6.</p>
        </div>
        {error && <p className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex gap-2">
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} disabled={admins.length >= 6} className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm">
              <option value="">{admins.length >= 6 ? "Maximum 6 BOQ admins reached." : "Select admin / manager"}</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.username} ({u.role})</option>)}
            </select>
            <button onClick={addAdmin} disabled={!selectedUserId || admins.length >= 6} className="h-11 rounded-xl bg-[#0a649d] px-4 text-xs font-black text-white disabled:opacity-40">Add</button>
          </div>
        </div>
        <div className="space-y-3">
          {admins.map((admin) => (
            <div key={admin.id} className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="text-sm font-black">{admin.name || admin.username}</p>
                <p className="text-xs text-slate-400">{admin.username} · {admin.role}</p>
              </div>
              <button onClick={() => removeAdmin(admin.userId)} className="h-9 rounded-xl border border-red-100 px-3 text-xs font-bold text-red-600">Remove</button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
