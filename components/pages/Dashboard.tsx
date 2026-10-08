"use client";

import { useUser } from "@/hooks/useUser";
import DashboardGerente from "../dashboards/DashboardGerente";
import DashboardAdmin from "../dashboards/DashboardAdmin";
import DashboardVendas from "../dashboards/DashboardVendas";
import DashboardInstalacao from "../dashboards/DashboardInstalacao";

export default function Dashboard() {
  const { user } = useUser();
  if (!user) return null;
  if (user.team === "gerente")    return <DashboardGerente />;
  if (user.team === "admin")      return <DashboardAdmin />;
  if (user.team === "vendas")     return <DashboardVendas />;
  return <DashboardInstalacao />;
}
