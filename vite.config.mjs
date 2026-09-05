import {defineConfig} from 'vite';
export default defineConfig({server:{proxy:{'/api':'http://127.0.0.1:8788','/media':'http://127.0.0.1:8788'}}});
