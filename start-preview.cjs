const { execSync } = require('child_process');
process.chdir('D:\\ccgl room');
execSync('npx vite --config vite.preview.config.ts', { stdio: 'inherit' });
