/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'localhost:3001',
        // GitHub Codespaces — autorise tous les sous-domaines *.app.github.dev
        '*.app.github.dev',
      ],
    },
  },
}

module.exports = nextConfig
