const fs = require('node:fs');
const path = require('node:path');

function getProjectName() {
  const rootDir = path.join(__dirname, '..');
  const angularJsonPath = path.join(rootDir, 'angular.json');
  const packageJsonPath = path.join(rootDir, 'package.json');
  
  if (fs.existsSync(angularJsonPath)) {
    try {
      const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
      const projects = angularJson.projects || {};
      const projectNames = Object.keys(projects);
      if (projectNames.length > 0) {
        return projectNames[0];
      }
    } catch (error) {
      console.warn(`⚠️  Warning: Could not read angular.json: ${error.message}`);
    }
  }
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.name) {
        return packageJson.name;
      }
    } catch (error) {
      console.warn(`⚠️  Warning: Could not read package.json: ${error.message}`);
    }
  }
  
  const distDir = path.join(rootDir, 'dist');
  if (fs.existsSync(distDir)) {
    try {
      const distContents = fs.readdirSync(distDir);
      const projectDirs = distContents.filter(item => {
        const itemPath = path.join(distDir, item);
        return fs.statSync(itemPath).isDirectory() && 
               fs.existsSync(path.join(itemPath, 'browser'));
      });
      if (projectDirs.length > 0) {
        return projectDirs[0];
      }
    } catch (error) {
      console.warn(`⚠️  Warning: Could not auto-detect project name from dist folder: ${error.message}`);
    }
  }
  
  throw new Error(
    'Could not determine project name. Please ensure angular.json or package.json exists and contains a project name.'
  );
}

const projectName = getProjectName();
const distDir = path.join(__dirname, '..', 'dist', projectName);
const browserDir = path.join(distDir, 'browser');
const indexHtmlPath = path.join(browserDir, 'index.html');
const jspTemplatePath = path.join(__dirname, '..', 'public', 'BOMComposer.jsp');
const outputJspPath = path.join(browserDir, 'BOMComposer.jsp');

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function readFileSafe(filePath, description) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content || content.trim().length === 0) {
      throw new Error(`${description} is empty`);
    }
    return content;
  } catch (error) {
    throw new Error(`Failed to read ${description} (${filePath}): ${error.message}`);
  }
}

function writeFileSafe(filePath, content, description) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    throw new Error(`Failed to write ${description} (${filePath}): ${error.message}`);
  }
}

function extractMatches(html, pattern) {
  const matches = new Set();
  let match;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(html)) !== null) {
    if (match[0]) {
      matches.add(match[0].trim());
    }
    if (pattern.lastIndex === match.index) {
      pattern.lastIndex++;
    }
  }
  return matches;
}

function extractStyles(html) {
  const styles = new Set();
  const stylePatterns = [
    /<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi,
    /<link[^>]*rel\s*=\s*["']preload["'][^>]*as\s*=\s*["']style["'][^>]*>/gi
  ];

  stylePatterns.forEach(pattern => {
    const matches = extractMatches(html, pattern);
    matches.forEach(m => styles.add(m));
  });

  const noscriptPattern = /<noscript>[\s\S]*?<\/noscript>/gi;
  const noscriptMatches = extractMatches(html, noscriptPattern);
  const linkPattern = /<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi;
  noscriptMatches.forEach(noscript => {
    const linkMatches = extractMatches(noscript, linkPattern);
    linkMatches.forEach(m => styles.add(m));
  });

  return Array.from(styles);
}

function extractPreloads(html) {
  const pattern = /<link[^>]*rel\s*=\s*["']modulepreload["'][^>]*>/gi;
  const matches = extractMatches(html, pattern);
  return Array.from(matches);
}

function extractScripts(html) {
  const pattern = /<script[^>]*type\s*=\s*["']module["'][^>]*><\/script>/gi;
  const matches = extractMatches(html, pattern);
  return Array.from(matches);
}

function extractAssets(html) {
  if (!html || typeof html !== 'string') {
    return { styles: [], preloads: [], scripts: [] };
  }

  return {
    styles: extractStyles(html),
    preloads: extractPreloads(html),
    scripts: extractScripts(html)
  };
}

function validateTemplate(template) {
  const requiredPlaceholders = ['<!-- ANGULAR_STYLES -->', '<!-- ANGULAR_SCRIPTS -->'];
  const missing = requiredPlaceholders.filter(placeholder => !template.includes(placeholder));
  
  if (missing.length > 0) {
    throw new Error(`Template is missing required placeholders: ${missing.join(', ')}`);
  }
}

try {
  if (!fs.existsSync(distDir)) {
    throw new Error(`Build output directory not found: ${distDir}\n   Please run "ng build" first.`);
  }

  if (!fs.existsSync(browserDir)) {
    throw new Error(`Browser output directory not found: ${browserDir}\n   Please run "ng build" first.`);
  }

  if (!fileExists(indexHtmlPath)) {
    throw new Error(`index.html not found: ${indexHtmlPath}\n   Please run "ng build" first.`);
  }

  if (!fileExists(jspTemplatePath)) {
    throw new Error(`JSP template not found: ${jspTemplatePath}`);
  }

  const indexHtml = readFileSafe(indexHtmlPath, 'index.html');
  const jspTemplate = readFileSafe(jspTemplatePath, 'JSP template');

  validateTemplate(jspTemplate);

  const { styles, preloads, scripts } = extractAssets(indexHtml);

  const stylesHtml = styles.length > 0 ? styles.join('\n  ') : '';
  const preloadsHtml = preloads.length > 0 ? preloads.join('\n  ') : '';
  const scriptsHtml = scripts.length > 0 ? scripts.join('\n  ') : '';

  let allScriptsHtml = scriptsHtml;
  if (preloadsHtml) {
    allScriptsHtml = scriptsHtml ? `${preloadsHtml}\n  ${scriptsHtml}` : preloadsHtml;
  }

  let finalJsp = jspTemplate;
  
  const stylesPlaceholderCount = (finalJsp.match(/<!-- ANGULAR_STYLES -->/g) || []).length;
  const scriptsPlaceholderCount = (finalJsp.match(/<!-- ANGULAR_SCRIPTS -->/g) || []).length;
  
  if (stylesPlaceholderCount > 1) {
    console.warn(`⚠️  Warning: Found ${stylesPlaceholderCount} ANGULAR_STYLES placeholders. All will be replaced.`);
  }
  
  if (scriptsPlaceholderCount > 1) {
    console.warn(`⚠️  Warning: Found ${scriptsPlaceholderCount} ANGULAR_SCRIPTS placeholders. All will be replaced.`);
  }

  if (!finalJsp.includes('<!-- ANGULAR_STYLES -->')) {
    throw new Error('Template missing ANGULAR_STYLES placeholder');
  }
  finalJsp = finalJsp.replaceAll('<!-- ANGULAR_STYLES -->', stylesHtml);

  if (!finalJsp.includes('<!-- ANGULAR_SCRIPTS -->')) {
    throw new Error('Template missing ANGULAR_SCRIPTS placeholder');
  }
  finalJsp = finalJsp.replaceAll('<!-- ANGULAR_SCRIPTS -->', allScriptsHtml);

  if (!finalJsp || finalJsp.trim().length === 0) {
    throw new Error('Generated JSP file is empty');
  }

  writeFileSafe(outputJspPath, finalJsp, 'BOMComposer.jsp');

  console.log('Successfully injected Angular assets into BOMComposer.jsp');
  console.log(`   Project: ${projectName}`);
  console.log(`   Output: ${outputJspPath}`);
  console.log(`   Styles: ${styles.length} file(s)`);
  console.log(`   Modulepreloads: ${preloads.length} file(s)`);
  console.log(`   Scripts: ${scripts.length} file(s)`);

} catch (error) {
  console.error('❌ Error:', error.message);
  if (error.stack && process.env.DEBUG) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
