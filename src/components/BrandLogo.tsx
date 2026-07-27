import Image from "next/image";

interface BrandLogoProps {
  size?: "sm" | "md";
}

const logoSizes = {
  sm: 32,
  md: 48,
} as const;

export default function BrandLogo({ size = "sm" }: BrandLogoProps) {
  const dimension = logoSizes[size];

  return (
    <Image
      src="/icons/icon-192.png"
      alt="Project Monitor logo"
      width={dimension}
      height={dimension}
      priority
      className="rounded-xl object-cover shadow-lg shadow-cyan-500/20"
    />
  );
}
