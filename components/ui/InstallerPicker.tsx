"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

type Option = { id: string; name: string };

type InstallerPickerProps = {
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
};

export default function InstallerPicker({ options, selected, onChange, placeholder = "Selecione a equipe" }: InstallerPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha a lista ao clicar fora
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  const selectedNames = options.filter((o) => selected.includes(o.id)).map((o) => o.name);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-sm text-left outline-none focus:border-[#f5c518]/50 transition-colors"
      >
        <span className={`truncate ${selectedNames.length ? "text-white" : "text-[#555]"}`}>
          {selectedNames.length ? selectedNames.join(", ") : placeholder}
        </span>
        <ChevronDown size={15} className={`flex-shrink-0 text-[#555] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#2a2a2a] bg-[#151515] py-1 shadow-xl">
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#555]">Nenhum instalador cadastrado.</p>
          )}
          {options.map((o) => {
            const isOn = selected.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-white hover:bg-[#1e1e1e] transition-colors"
              >
                {o.name}
                {isOn && <Check size={14} className="text-[#f5c518]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}