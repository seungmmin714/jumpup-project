import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'node:path';

// Web Bluetooth는 보안 컨텍스트에서만 동작한다. 휴대폰이 LAN 주소(http://192.168.x.x)로
// 접속하면 navigator.bluetooth 자체가 없다 → HTTPS=1로 띄우면 자체서명 인증서로 열린다.
const useHttps = process.env.HTTPS === '1';

export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: true,
    port: 5173,
    // 개발 중에는 /api를 로컬 백엔드(server/)로 넘긴다.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    // 제품 기본값은 ble이다(S-02). 테스트는 하드웨어가 없으므로 mock을 명시한다.
    env: { VITE_BLE_MODE: 'mock' },
    // 순수 로직은 node, 화면 테스트는 파일 상단의 @vitest-environment 주석으로 jsdom 전환
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
