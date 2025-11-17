import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    // Nested repo quruluşunda doğru root-u göstərir
    root: __dirname
  }
};

export default nextConfig;
