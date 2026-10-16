import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const paper = '#f5f1e9';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      sizes: [512],
      padding: 0.3,
      resizeOptions: { fit: 'contain', background: paper },
    },
    apple: {
      sizes: [180],
      padding: 0.3,
      resizeOptions: { fit: 'contain', background: paper },
    },
  },
  images: ['public/icon-source.svg'],
});
