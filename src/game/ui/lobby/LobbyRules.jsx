import { fieldsFor, fieldText } from "@/game/lobby/fieldsFor";
import RuleField from "@/game/ui/RuleField";

// The lobby's rules: the host edits them live (every change reaches every player), guests read them.
export default function LobbyRules({ rules, editable, onChange }) {
  const fields = fieldsFor(rules);
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] uppercase tracking-[0.25em] text-[#a8987f]">Rules · {rules.name}{editable ? "" : " · set by the host"}</div>
      {editable ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((f) => <RuleField key={f.key} f={f} value={rules[f.key]} onChange={(v) => onChange({ ...rules, [f.key]: v })} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className="flex justify-between gap-2 border-t border-[#3a362f] py-1 text-sm">
              <span className="text-[#a8987f]">{f.label}</span>
              <span className="truncate text-right text-[#f4ead6]">{fieldText(f, rules[f.key])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}