const nextConfig = {
  async redirects() {
    return [{ source: '/index.html', destination: '/', permanent: true }];
  },
};
export default nextConfig;