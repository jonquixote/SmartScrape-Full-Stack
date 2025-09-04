// Test script to verify file structure and basic functionality
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyProjectStructure() {
  try {
    console.log('🔍 Verifying SmartScrape Project Structure...\n');
    
    // Check for required files and directories
    const requiredFiles = [
      'README.md',
      'package.json',
      'ecosystem.config.cjs',
      'src/index.tsx',
      'src/routes/crawl.ts',
      'src/routes/simplified-crawl.ts',
      'public/index.html',
      'DOCS/SIMPLIFIED_UI.md',
      'FINAL_SUMMARY.md'
    ];
    
    let allFilesExist = true;
    
    for (const file of requiredFiles) {
      const fullPath = path.join(__dirname, file);
      if (fs.existsSync(fullPath)) {
        console.log(`✅ Found: ${file}`);
      } else {
        console.log(`❌ Missing: ${file}`);
        allFilesExist = false;
      }
    }
    
    if (allFilesExist) {
      console.log('\n🎉 All required files are present!');
    } else {
      console.log('\n⚠️  Some required files are missing.');
    }
    
    // Check package.json for required scripts
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    
    const requiredScripts = [
      'dev',
      'dev:sandbox',
      'build',
      'deploy',
      'db:migrate:local'
    ];
    
    console.log('\n🔍 Checking package.json scripts...');
    
    let allScriptsExist = true;
    
    for (const script of requiredScripts) {
      if (packageJson.scripts && packageJson.scripts[script]) {
        console.log(`✅ Found script: ${script}`);
      } else {
        console.log(`❌ Missing script: ${script}`);
        allScriptsExist = false;
      }
    }
    
    if (allScriptsExist) {
      console.log('\n🎉 All required scripts are present!');
    } else {
      console.log('\n⚠️  Some required scripts are missing.');
    }
    
    console.log('\n📋 Project structure verification complete.');
    console.log('💡 Next steps:');
    console.log('   1. Run ./start.sh to start the application');
    console.log('   2. Visit http://localhost:3000 in your browser');
    console.log('   3. Check the FINAL_SUMMARY.md for implementation details');
    
  } catch (error) {
    console.error('❌ Error verifying project structure:', error.message);
  }
}

verifyProjectStructure();