import { defineConfig, splitVendorChunkPlugin } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	base: '/',
	plugins: [react(), splitVendorChunkPlugin()],
	server: {
		proxy: {
			'/api': {
				target: 'https://qaportal-backend-iyjk.onrender.com',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, ''),
				secure: true,
			}
		}
	},
	build: {
		chunkSizeWarningLimit: 1000,
		rollupOptions: {
			output: {
				manualChunks: {
					react: ['react', 'react-dom'],
					react_query: ['@tanstack/react-query'],
					router: ['react-router-dom'],
					utils: ['zustand']
				}
			}
		}
	}
});


