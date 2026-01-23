const fs = require('fs');
const path = require('path');

// Configuration
const projectName = 'ag-grid-app';
const distDir = path.join(__dirname, '..', 'dist', projectName);
const browserDir = path.join(distDir, 'browser');
const indexHtmlPath = path.join(browserDir, 'index.html');
const jspTemplatePath = path.join(__dirname, '..', 'public', 'BOMComposer.jsp');
const outputJspPath = path.join(browserDir, 'BOMComposer.jsp');

// Helper function to safely check if file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

// Helper function to safely read file
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

// Helper function to safely write file
function writeFileSafe(filePath, content, description) {
  try {
    // Ensure directory exists
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

// Helper function to safely delete file
function deleteFileSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`⚠️  Warning: Could not delete ${filePath}: ${error.message}`);
    return false;
  }
}

// Extract unique assets from HTML
function extractAssets(html) {
  if (!html || typeof html !== 'string') {
    return { styles: [], scripts: [] };
  }

  const styles = new Set();
  const scripts = new Set();

  // Extract stylesheet links (including preload with as="style")
  const stylePatterns = [
    /<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi,
    /<link[^>]*rel\s*=\s*["']preload["'][^>]*as\s*=\s*["']style["'][^>]*>/gi
  ];

  stylePatterns.forEach(pattern => {
    let match;
    // Reset regex lastIndex to avoid issues
    pattern.lastIndex = 0;
    while ((match = pattern.exec(html)) !== null) {
      if (match[0]) {
        styles.add(match[0].trim());
      }
      // Prevent infinite loop on zero-length matches
      if (pattern.lastIndex === match.index) {
        pattern.lastIndex++;
      }
    }
  });

  // Extract noscript fallback styles
  const noscriptPattern = /<noscript>[\s\S]*?<\/noscript>/gi;
  let noscriptMatch;
  noscriptPattern.lastIndex = 0;
  while ((noscriptMatch = noscriptPattern.exec(html)) !== null) {
    const linkPattern = /<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi;
    let linkMatch;
    linkPattern.lastIndex = 0;
    while ((linkMatch = linkPattern.exec(noscriptMatch[0])) !== null) {
      if (linkMatch[0]) {
        styles.add(linkMatch[0].trim());
      }
      if (linkPattern.lastIndex === linkMatch.index) {
        linkPattern.lastIndex++;
      }
    }
  }

  // Extract script tags
  const scriptPattern = /<script[^>]*><\/script>/gi;
  let scriptMatch;
  scriptPattern.lastIndex = 0;
  while ((scriptMatch = scriptPattern.exec(html)) !== null) {
    if (scriptMatch[0]) {
      scripts.add(scriptMatch[0].trim());
    }
    if (scriptPattern.lastIndex === scriptMatch.index) {
      scriptPattern.lastIndex++;
    }
  }

  // Extract modulepreload links
  const modulepreloadPattern = /<link[^>]*rel\s*=\s*["']modulepreload["'][^>]*>/gi;
  let modulepreloadMatch;
  modulepreloadPattern.lastIndex = 0;
  while ((modulepreloadMatch = modulepreloadPattern.exec(html)) !== null) {
    if (modulepreloadMatch[0]) {
      scripts.add(modulepreloadMatch[0].trim());
    }
    if (modulepreloadPattern.lastIndex === modulepreloadMatch.index) {
      modulepreloadPattern.lastIndex++;
    }
  }

  return {
    styles: Array.from(styles),
    scripts: Array.from(scripts)
  };
}

// Validate template has required placeholders
function validateTemplate(template) {
  const requiredPlaceholders = ['<!-- ANGULAR_STYLES -->', '<!-- ANGULAR_SCRIPTS -->'];
  const missing = requiredPlaceholders.filter(placeholder => !template.includes(placeholder));
  
  if (missing.length > 0) {
    throw new Error(`Template is missing required placeholders: ${missing.join(', ')}`);
  }
}

// Main execution
try {
  // Validate directories
  if (!fs.existsSync(distDir)) {
    throw new Error(`Build output directory not found: ${distDir}\n   Please run "ng build" first.`);
  }

  // Check browser directory (Angular v17+ uses browser subdirectory)
  if (!fs.existsSync(browserDir)) {
    throw new Error(`Browser output directory not found: ${browserDir}\n   Please run "ng build" first.`);
  }

  // Validate required files exist
  if (!fileExists(indexHtmlPath)) {
    throw new Error(`index.html not found: ${indexHtmlPath}\n   Please run "ng build" first.`);
  }

  if (!fileExists(jspTemplatePath)) {
    throw new Error(`JSP template not found: ${jspTemplatePath}`);
  }

  // Read files
  const indexHtml = readFileSafe(indexHtmlPath, 'index.html');
  const jspTemplate = readFileSafe(jspTemplatePath, 'JSP template');

  // Validate template structure
  validateTemplate(jspTemplate);

  // Extract assets (deduplicated)
  const { styles, scripts } = extractAssets(indexHtml);

  if (styles.length === 0) {
    console.warn('⚠️  Warning: No styles found in index.html');
  }

  if (scripts.length === 0) {
    console.warn('⚠️  Warning: No scripts found in index.html');
  }

  // Build replacement strings
  const stylesHtml = styles.length > 0 ? styles.join('\n  ') : '';
  const scriptsHtml = scripts.length > 0 ? scripts.join('\n  ') : '';

  // Replace placeholders in template
  let finalJsp = jspTemplate;
  
  if (!finalJsp.includes('<!-- ANGULAR_STYLES -->')) {
    throw new Error('Template missing ANGULAR_STYLES placeholder');
  }
  finalJsp = finalJsp.replace('<!-- ANGULAR_STYLES -->', stylesHtml);

  if (!finalJsp.includes('<!-- ANGULAR_SCRIPTS -->')) {
    throw new Error('Template missing ANGULAR_SCRIPTS placeholder');
  }
  finalJsp = finalJsp.replace('<!-- ANGULAR_SCRIPTS -->', scriptsHtml);

  // Validate output before writing
  if (!finalJsp || finalJsp.trim().length === 0) {
    throw new Error('Generated JSP file is empty');
  }

  // Write the final JSP file
  writeFileSafe(outputJspPath, finalJsp, 'BOMComposer.jsp');

  // Delete index.html from dist (no longer needed)
  if (deleteFileSafe(indexHtmlPath)) {
    console.log('🗑️  Deleted index.html from dist (not needed for JSP deployment)');
  }

  // Success message
  console.log('✅ Successfully injected Angular assets into BOMComposer.jsp');
  console.log(`   Output: ${outputJspPath}`);
  console.log(`   Styles: ${styles.length} file(s)`);
  console.log(`   Scripts: ${scripts.length} file(s)`);

} catch (error) {
  console.error('❌ Error:', error.message);
  if (error.stack && process.env.DEBUG) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
