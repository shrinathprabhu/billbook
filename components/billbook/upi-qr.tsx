/* oxlint-disable jsx-a11y/prefer-tag-over-role */
// Inline SVG needs an accessible image role and must remain vector for exports.
import QRCode from 'qrcode';

export default function UpiQr({ value }: { value: string }) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const quietZone = 4;
  const size = modules.size + quietZone * 2;
  let pixels = '';
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (modules.get(y, x))
        pixels += `M${x + quietZone} ${y + quietZone}h1v1h-1z`;
    }
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="upi-qr"
      width="160"
      height="160"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Scan to pay by UPI"
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={pixels} fill="#000000" />
    </svg>
  );
}
