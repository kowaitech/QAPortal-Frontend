import { defineConfig, splitVendorChunkPlugin } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	base: '/',
	plugins: [react(), splitVendorChunkPlugin()],
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


