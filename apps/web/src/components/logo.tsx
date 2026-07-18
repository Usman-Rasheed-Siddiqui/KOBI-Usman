import Link from "next/link";
import Image from "next/image";
export function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="focus-ring inline-flex items-center gap-2.5 rounded-2xl" aria-label="KOBI home">
    <span className="grid size-11 place-items-center overflow-hidden rounded-[16px] border border-black/8 bg-white/75 shadow-[0_10px_28px_rgba(34,44,38,.12)]">
      <Image src="/brand/kobi-logo-mark.png" alt="" width={44} height={44} className="size-10 object-contain" priority />
    </span>
    {!compact && <span className="text-[18px] font-semibold tracking-[-.03em] text-[#111a15]">KOBI</span>}
  </Link>;
}
