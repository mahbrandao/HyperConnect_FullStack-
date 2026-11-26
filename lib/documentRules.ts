// Documentos obrigatórios de todo projeto. Para mudar, é só editar esta lista
// (vale para a tela de Documentos e para o painel do admin).
export const REQUIRED_DOC_TYPES = ["Contrato", "RG", "Conta de água"];

/** Tipos obrigatórios que ainda não foram enviados para o projeto. */
export function missingDocTypes(projectId: string, docs: { project_id: string | null; doc_type: string }[]) {
  return REQUIRED_DOC_TYPES.filter((t) => !docs.some((d) => d.project_id === projectId && d.doc_type === t));
}
