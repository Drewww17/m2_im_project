import Image from 'next/image';

export default function BrandLogo({
  size = 56,
  showText = false,
  stacked = false,
  priority = false,
  className = '',
  textClassName = ''
}) {
  return (
    <div className={`flex ${stacked ? 'flex-col' : 'items-center'} gap-3 ${className}`}>
      <Image
        src="/kenzovan%20logo.jpg"
        alt="Khenzo Van's Agrivet"
        width={size}
        height={size}
        priority={priority}
        className="shrink-0 rounded-full"
      />
      {showText && (
        <div className={textClassName}>
          <p className="text-base font-bold leading-tight">Khenzo Van&apos;s</p>
          <p className="text-sm font-semibold uppercase tracking-[0.18em]">Agrivet</p>
        </div>
      )}
    </div>
  );
}
