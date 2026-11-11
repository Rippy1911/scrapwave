import { useState } from "react";
import { cleanName } from "@/game/net/driver";

// First online launch (or "Change name"): the name other drivers see over your car.
export default function NameCard({ initial = "", onSave, onCancel }) {
  const [name, setName] = useState(initial);
  const ok = cleanName(name).length >= 2;
  const submit = (e) => { e.preventDefault(); if (ok) onSave(cleanName(name)); };
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(10,7,5,0.75)] p-4 sw-body text-[#e9dcc4]">
      <form onSubmit={submit} className="sw-panel w-full max-w-sm p-6 flex flex-col gap-4 sw-slide">
        <h2 className="sw-display text-2xl text-[#f2c230] tracking-wider">DRIVER NAME</h2>
        <p className="text-sm text-[#a8987f]">Other drivers see this over your car and in chat.</p>
        <input autoFocus maxLength={16} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rust Bucket"
          className="rounded-sm border-2 border-[#57503f] bg-[#16130f] px-3 py-2 text-lg text-[#f2e6c8] outline-none focus:border-[#f2c230]" />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="sw-btn px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={!ok} className="sw-btn sw-btn-primary px-6 py-2 text-sm disabled:opacity-50">Save</button>
        </div>
      </form>
    </div>
  );
}