const fs = require('node:fs');
const path = require('node:path');

const JSP_FILE_NAME = 'bomComposer.jsp';

function getBrowserOutputDir() {
  const angularJsonPath = path.join(__dirname, '..', 'angular.json');
  try {
    const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
    const projectNames = Object.keys(angularJson.projects || {});
    if (projectNames.length === 0) {
      throw new Error('No projects found in angular.json');
    }

    const project = angularJson.projects[projectNames[0]];
    const outputPath = project?.architect?.build?.options?.outputPath;

    if (!outputPath) {
      return path.join(__dirname, '..', 'dist', projectNames[0], 'browser');
    }

    if (typeof outputPath === 'string') {
      return path.join(__dirname, '..', outputPath, 'browser');
    }

    const base = outputPath.base || 'dist';
    const browser = outputPath.browser ?? 'browser';
    return browser
      ? path.join(__dirname, '..', base, browser)
      : path.join(__dirname, '..', base);
  } catch (error) {
    throw new Error(`Failed to read outputPath from angular.json: ${error.message}`);
  }
}

const browserDir = getBrowserOutputDir();
const indexHtmlPath = path.join(browserDir, 'index.html');
const jspTemplatePath = path.join(__dirname, '..', 'public', JSP_FILE_NAME);
const outputJspPath = path.join(browserDir, JSP_FILE_NAME);

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
  const noscriptBlocks = extractMatches(html, /<noscript>[\s\S]*?<\/noscript>/gi);
  const htmlWithoutNoscript = html.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');
  const styles = [];
  const patterns = [
    /<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi,
    /<link[^>]*rel\s*=\s*["']preload["'][^>]*as\s*=\s*["']style["'][^>]*>/gi
  ];

  patterns.forEach(pattern => {
    styles.push(...extractMatches(htmlWithoutNoscript, pattern));
  });

  return [...new Set([...styles, ...noscriptBlocks])];
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

function removeNonRuntimeBuildArtifacts(outputDir) {
  const artifacts = ['prerendered-routes.json', '3rdpartylicenses.txt'];
  for (const fileName of artifacts) {
    const filePath = path.join(outputDir, fileName);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
      console.log(`   Removed: ${fileName}`);
    }
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
  removeNonRuntimeBuildArtifacts(browserDir);

  console.log(`Successfully injected Angular assets into ${JSP_FILE_NAME}`);
  console.log(`   Output: ${outputJspPath}`);
  console.log(`   Styles: ${styles.length} file(s)`);
  console.log(`   Modulepreloads: ${preloads.length} file(s)`);
  console.log(`   Scripts: ${scripts.length} file(s)`);

} catch (error) {
  console.error('Error:', error.message);
  if (process.env.DEBUG) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
