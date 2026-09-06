/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // El servicio de producción (controlplazas_front.service) sirve el bundle de
  // `.next`. Para poder levantar un `next dev` de verificación sin pisar ese
  // bundle, la carpeta de build se puede desviar con NEXT_DIST_DIR
  // (p. ej. `NEXT_DIST_DIR=.next-dev npm run dev`). Sin la variable, el
  // comportamiento es exactamente el de antes.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  allowedDevOrigins: ['192.168.1.76', '10.150.25.0', '89.116.51.124:3030'],
  compress: true,
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'date-fns',
      '@heroicons/react',
    ],
  },
};

export default nextConfig;
