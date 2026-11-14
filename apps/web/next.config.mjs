/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Badge and partner images are small static JPEGs; serving them as-is avoids
  // running the image optimiser (and its memory use) on the shared droplet.
  images: { unoptimized: true },
  // The admin UI talks to the API directly; no server-side proxying needed yet.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4100/api/v1",
  },
};
export default nextConfig;
