const fs = require('node:fs');
const path = require('node:path');

function getProjectName() {
  const angularJsonPath = path.join(__dirname, '..', 'angular.json');
  try {
    const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
    const projectNames = Object.keys(angularJson.projects || {});
    if (projectNames.length === 0) {
      throw new Error('No projects found in angular.json');
    }
    return projectNames[0];
  } catch (error) {
    throw new Error(`Failed to read project name from angular.json: ${error.message}`);
  }
}

const projectName = getProjectName();
const distDir = path.join(__dirname, '..', 'dist', projectName);
const browserDir = path.join(distDir, 'browser');
const indexHtmlPath = path.join(browserDir, 'index.html');
const jspTemplatePath = path.join(__dirname, '..', 'public', 'BOMComposer.jsp');
const outputJspPath = path.join(browserDir, 'BOMComposer.jsp');

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read file: ${filePath} - ${error.message}`);
  }
}

function writeFile(filePath, content) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (error) {
    throw new Error(`Failed to write file: ${filePath} - ${error.message}`);
  }
}

function extractMatches(html, pattern) {
  const matches = [];
  let match;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(html)) !== null) {
    if (match[0]) {
      matches.push(match[0].trim());
    }
    if (pattern.lastIndex === match.index) {
      pattern.lastIndex++;
    }
  }
  return [...new Set(matches)];
}

function extractStyles(html) {
  const styles = [];
  const patterns = [
    /<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi,
    /<link[^>]*rel\s*=\s*["']preload["'][^>]*as\s*=\s*["']style["'][^>]*>/gi
  ];

  patterns.forEach(pattern => {
    styles.push(...extractMatches(html, pattern));
  });

  const noscriptMatches = extractMatches(html, /<noscript>[\s\S]*?<\/noscript>/gi);
  const linkPattern = /<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi;
  noscriptMatches.forEach(noscript => {
    styles.push(...extractMatches(noscript, linkPattern));
  });

  return [...new Set(styles)];
}

function extractPreloads(html) {
  return extractMatches(html, /<link[^>]*rel\s*=\s*["']modulepreload["'][^>]*>/gi);
}

function extractScripts(html) {
  return extractMatches(html, /<script[^>]*type\s*=\s*["']module["'][^>]*><\/script>/gi);
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
  if (!template.includes('<!-- ANGULAR_STYLES -->') || !template.includes('<!-- ANGULAR_SCRIPTS -->')) {
    throw new Error('Template missing required placeholders');
  }
}

try {
  if (!fs.existsSync(browserDir)) {
    throw new Error(`Build output directory not found: ${browserDir}\n   Please run "ng build" first.`);
  }

  const indexHtml = readFile(indexHtmlPath);
  const jspTemplate = readFile(jspTemplatePath);

  validateTemplate(jspTemplate);

  const { styles, preloads, scripts } = extractAssets(indexHtml);

  const stylesHtml = styles.join('\n  ');
  const allScriptsHtml = [preloads, scripts].flat().filter(Boolean).join('\n  ');

  let finalJsp = jspTemplate
    .replaceAll('<!-- ANGULAR_STYLES -->', stylesHtml)
    .replaceAll('<!-- ANGULAR_SCRIPTS -->', allScriptsHtml);

  if (!finalJsp.trim()) {
    throw new Error('Generated JSP file is empty');
  }

  writeFile(outputJspPath, finalJsp);

  console.log('Successfully injected Angular assets into BOMComposer.jsp');
  console.log(`   Project: ${projectName}`);
  console.log(`   Output: ${outputJspPath}`);
  console.log(`   Styles: ${styles.length} file(s)`);
  console.log(`   Modulepreloads: ${preloads.length} file(s)`);
  console.log(`   Scripts: ${scripts.length} file(s)`);

} catch (error) {
  console.error('❌ Error:', error.message);
  if (process.env.DEBUG) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
