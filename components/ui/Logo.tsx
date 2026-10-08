export default function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const textSize = size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl";
  const iconSize = size === "sm" ? "w-6 h-6" : size === "lg" ? "w-10 h-10" : "w-8 h-8";

  return (
    <div className="flex items-center gap-2">
      <div className={`${iconSize} flex items-center justify-center`}>
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <polygon points="18,2 8,18 16,18 14,30 24,14 16,14" fill="#f5c518" />
        </svg>
      </div>
      <span className={`font-black tracking-tight text-white ${textSize}`}>HYPER<span className="text-[#f5c518]">Z</span></span>
    </div>
  );
}
