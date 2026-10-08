import { ChevronRight, MessageCircle } from "lucide-react";

const services = [
  {
    title: "Energia Solar",
    icon: "☀️",
    img: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400&h=200&fit=crop&auto=format",
    desc: "Soluções completas em sistemas fotovoltaicos para geração de energia limpa e sustentável.",
    items: ["Projeto personalizado", "Homologação junto à concessionária", "Monitoramento de geração"],
  },
  {
    title: "Automação",
    icon: "⚙️",
    img: "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=400&h=200&fit=crop&auto=format",
    desc: "Automatizamos processos industriais para aumentar a eficiência, reduzir custos e garantir qualidade.",
    items: ["Automação de processos", "CLPs e IHM", "Integração de sistemas", "Manutenção preventiva"],
  },
  {
    title: "Instalação e Manutenção",
    icon: "🔧",
    img: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=200&fit=crop&auto=format",
    desc: "Equipe técnica especializada para instalações seguras e manutenção preventiva e corretiva.",
    items: ["Instalação elétrica", "Manutenção preventiva", "Manutenção corretiva", "Suporte técnico"],
  },
];

export default function Services() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Nossos serviços</h1>
        <p className="text-[#888] text-sm">Soluções completas em energia solar e automação.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {services.map(({ title, icon, img, desc, items }) => (
          <div key={title} className="bg-[#151515] border border-[#222] rounded-xl overflow-hidden hover:border-[#333] transition-colors group">
            <img src={img} alt={title} className="w-full h-40 object-cover" />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{icon}</span>
                <h3 className="font-semibold text-white">{title}</h3>
              </div>
              <p className="text-xs text-[#888] leading-relaxed mb-4">{desc}</p>
              <ul className="space-y-1.5 mb-5">
                {items.map((item) => (
                  <li key={item} className="text-xs text-[#aaa] flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#f5c518] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button className="text-sm font-medium text-[#f5c518] hover:underline flex items-center gap-1">
                Saiba mais <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#f5c518]/5 border border-[#f5c518]/20 rounded-xl p-6 flex items-center justify-between">
        <div>
          <p className="font-semibold text-white mb-1">Precisando de uma solução personalizada?</p>
          <p className="text-sm text-[#888]">Fale com nossos especialistas e encontre a melhor solução para sua empresa.</p>
        </div>
        <button className="flex-shrink-0 bg-[#f5c518] text-black font-bold px-5 py-2.5 rounded-lg hover:bg-[#e6b800] transition-colors text-sm flex items-center gap-2 ml-8">
          <MessageCircle size={16} />
          Falar com especialista
        </button>
      </div>
    </div>
  );
}
