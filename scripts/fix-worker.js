const fs = require('fs');
const path = require('path');

const distWorkerPath = path.join(__dirname, '../dist/shared-worker.js');
const publicWorkerPath = path.join(__dirname, '../public/shared-worker.js');

if (fs.existsSync(distWorkerPath)) {
  let content = fs.readFileSync(distWorkerPath, 'utf8');
  // Remove export {}; at the end of the file
  content = content.replace(/export\s*{\s*};?\s*$/m, '');
  // Remove trailing newlines
  content = content.trimEnd() + '\n';
  fs.writeFileSync(distWorkerPath, content, 'utf8');
  console.log('Fixed dist/shared-worker.js: removed export {}');
  
  // Copy to public directory
  fs.writeFileSync(publicWorkerPath, content, 'utf8');
  console.log('Copied to public/shared-worker.js');
} else {
  console.warn('shared-worker.js not found at:', distWorkerPath);
}
