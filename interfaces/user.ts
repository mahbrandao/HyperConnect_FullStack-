export type Team = "gerente" | "admin" | "vendas" | "instalacao";

export interface User {
  id: string;
  name: string;
  team: Team | null;
  teamLabel: string | null;
  avatar: string | null;
}
