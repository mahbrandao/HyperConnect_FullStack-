export type Stage = "Orçamento" | "Aprovado" | "Em Instalação" | "Manutenção" | "Concluído";
export type PaymentMethod = "Pix" | "Boleto" | "Cartão" | "Após instalação" | "Financiamento";

export interface Project {
  id: string;
  title: string;
  client: string;
  type: string;
  stage: Stage;
  progress: number;
  vendedor: string;
  instalador: string; // nomes da equipe de instalação, separados por vírgula
  instaladores: { id: string; name: string }[];
  vendedorId?: string | null;
  start: string;
  end: string;
  img: string;
  isPriority: boolean;
  value: number;
  valorSistema?: number;
  valorMO?: number;
  valorAReceber?: number;
  dataPgto?: string | null;
  paymentMethod?: PaymentMethod | null;
  notes?: string;
}
