// Admin entry: F10 or a small button, both only for the admin (Base44 admin role or the local developer flag).
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin, setRoleAdmin, onAdminChange } from "@/game/air/admin";
import AdminPanel from "@/game/ui/admin/AdminPanel";
import CustomGame from "@/game/ui/CustomGame";

export default function AdminLayer({ game, playing, onRules }) {
  const { user } = useAuth();
  const [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [rules, setRulesOpen] = useState(false);

  useEffect(() => { setRoleAdmin(user?.role === "admin"); }, [user]);
  useEffect(() => { setAdmin(isAdmin()); return onAdminChange(setAdmin); }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== "F10") return;
      e.preventDefault();
      if (isAdmin() && playing) setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);
  useEffect(() => { if (open && document.pointerLockElement) document.exitPointerLock(); }, [open]);
  useEffect(() => { if (game) game.uiOpen = rules; }, [rules, game]);

  if (!admin || !game || !playing) return null;
  return (
    <>
      {!open && <button onClick={() => setOpen(true)} className="fixed left-1/2 top-2 z-30 -translate-x-1/2 sw-btn px-3 py-0.5 text-[10px]">Admin · F10</button>}
      {open && <AdminPanel game={game} onRules={() => setRulesOpen(true)} onClose={() => setOpen(false)} />}
      {rules && <div className="fixed inset-0 z-50"><CustomGame onPlay={(r) => { setRulesOpen(false); setOpen(false); onRules(r); }} onClose={() => setRulesOpen(false)} /></div>}
    </>
  );
}