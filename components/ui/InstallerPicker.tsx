"use client";

type Person = { id: string; name: string };

// Lista de checkboxes pra escolher vários instaladores
export default function InstallerPicker({
  options,
  selected,
  onChange,
}: {
  options: Person[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (options.length === 0) {
    return <p className="text-xs text-[#555]">Nenhum instalador com acesso ao sistema ainda (cadastre em Funcionários).</p>;
  }
  return (
    <div className="max-h-36 overflow-y-auto rounded-lg border border-[#2a2a2a] bg-[#111] divide-y divide-[#1a1a1a]">
      {options.map((o) => {
        const checked = selected.includes(o.id);
        return (
          <label key={o.id} className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#ddd] cursor-pointer hover:bg-[#161616] select-none">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange(checked ? selected.filter((id) => id !== o.id) : [...selected, o.id])}
              className="h-4 w-4 rounded border-[#333] bg-[#111] accent-[#f5c518]"
            />
            {o.name}
          </label>
        );
      })}
    </div>
  );
}
