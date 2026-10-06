/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // El servicio de producción (controlplazas_front.service) sirve el bundle de
  // `.next`. Para poder levantar un `next dev` de verificación sin pisar ese
  // bundle, la carpeta de build se puede desviar con NEXT_DIST_DIR
  // (p. ej. `NEXT_DIST_DIR=.next-dev npm run dev`). Sin la variable, el
  // comportamiento es exactamente el de antes.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  allowedDevOrigins: ['192.168.1.76', '10.150.25.0'],
  // Imagen Docker mínima: copia solo los módulos que el server realmente usa.
  output: 'standalone',
  // nginx del host ya comprime (gzip); evitar doble trabajo en Node.
  compress: false,
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // La portada antigua (`/`) quedó desactivada: entrar al sistema lleva
  // directo al dashboard (y `proxy.js` manda a /login si no hay sesión).
  // Temporal (307) para que el navegador no la memorice si algún día se
  // reactiva la portada.
  async redirects() {
    return [{ source: '/', destination: '/dashboard', permanent: false }];
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
