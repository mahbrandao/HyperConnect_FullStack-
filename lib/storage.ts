// Nomes de arquivo no Storage do Supabase não aceitam acentos/espaços/símbolos.
export function safeFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  const cleanBase = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 80) || "arquivo";
  const cleanExt = ext.normalize("NFD").replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();
  return `${cleanBase}${cleanExt}`;
}
