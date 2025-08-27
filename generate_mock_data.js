const fs = require('fs');
const path = require('path');

// Read the CSV file
const csvFilePath = path.join(__dirname, 'public', 'ResultsTable-FilteredData.csv');
const mockDataPath = path.join(__dirname, 'public', 'mock.json');

// CSV Parser function that handles quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

try {
  // Read file as buffer to handle encoding
  const fileBuffer = fs.readFileSync(csvFilePath);
  let fileContent;
  
  // Try to detect encoding and convert to UTF-8
  if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xFE) {
    // UTF-16 LE
    fileContent = fileBuffer.toString('utf16le');
  } else if (fileBuffer[0] === 0xFE && fileBuffer[1] === 0xFF) {
    // UTF-16 BE
    fileContent = fileBuffer.toString('utf16be');
  } else {
    // Assume UTF-8
    fileContent = fileBuffer.toString('utf8');
  }
  
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  // Parse header
  const header = parseCSVLine(lines[0]);
  console.log('Headers:', header);
  
  // Parse data rows
  const dataRows = lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    
    return {
      part: values[0] || '',
      feature: values[1] || '',
      supplier: values[2] || '',
      color: values[3] || '',
      shortDesc: values[4] || '',
      longDesc: values[5] || '',
      startDate: values[6] || '',
      endDate: values[7] || '',
      qty: parseInt(values[8]) || 0
    };
  }).filter(row => row.part && row.part.trim()); // Filter out empty rows
  
  console.log(`Total data rows: ${dataRows.length}`);
  
  // Generate SKUs for each unique part-feature-supplier combination
  const uniqueCombinations = [...new Set(dataRows.map(row => 
    `${row.part}-${row.feature}-${row.supplier}`
  ))];
  console.log(`Unique part-feature-supplier combinations: ${uniqueCombinations.length}`);
  
  // Create SKU mapping with multiple SKUs per part
  const skuMapping = {};
  const allSkus = [];
  
  uniqueCombinations.forEach((combination, index) => {
    const [part, feature, supplier] = combination.split('-');
    const baseSku = 5134567 + index;
    
    // Generate 2-5 SKUs per part based on quantity and feature
    const numSkus = Math.min(5, Math.max(2, Math.floor(Math.random() * 4) + 2));
    const skus = [];
    
    for (let i = 0; i < numSkus; i++) {
      const skuNumber = baseSku + i;
      skus.push(skuNumber.toString());
      allSkus.push({
        sku: skuNumber.toString(),
        product: "100690",
        manufacturer: supplier || "Generic Supplier",
        color: "Generic Color",
        size: `Size ${i + 1}`
      });
    }
    
    skuMapping[combination] = skus;
  });
  
  // Transform to mock data format
  const mbom = dataRows.map((row, index) => {
    const combination = `${row.part}-${row.feature}-${row.supplier}`;
    const skus = skuMapping[combination] || [];
    
    return {
      part: row.part,
      feature: row.feature,
      supplier: row.supplier,
      color: row.color,
      shortDesc: row.shortDesc,
      longDesc: row.longDesc,
      startDate: row.startDate,
      endDate: row.endDate,
      qty: row.qty,
      skus: skus
    };
  });
  
  // Remove duplicate SKUs from allSkus
  const uniqueSkus = allSkus.filter((sku, index, self) => 
    index === self.findIndex(s => s.sku === sku.sku)
  );
  
  const mockData = {
    mbom: mbom,
    productInfo: {
      productId: "100690",
      productName: "Product 100690",
      skus: uniqueSkus
    }
  };
  
  // Write to mock.json
  fs.writeFileSync(mockDataPath, JSON.stringify(mockData, null, 2));
  
  console.log(`Mock data generated successfully!`);
  console.log(`- Total MBOM entries: ${mbom.length}`);
  console.log(`- Total unique SKUs: ${uniqueSkus.length}`);
  console.log(`- Output file: ${mockDataPath}`);
  
  // Show SKU distribution
  console.log('\nSKU Distribution:');
  const skuCounts = mbom.map(entry => entry.skus.length);
  const avgSkus = skuCounts.reduce((a, b) => a + b, 0) / skuCounts.length;
  console.log(`- Average SKUs per part: ${avgSkus.toFixed(2)}`);
  console.log(`- Parts with SKUs: ${skuCounts.filter(count => count > 0).length}`);
  console.log(`- Parts without SKUs: ${skuCounts.filter(count => count === 0).length}`);
  
} catch (error) {
  console.error('Error processing file:', error);
}

// Helper function to extract color from color name
function getColorFromColorName(colorName) {
  if (!colorName) return "Generic Color";
  
  // Extract color prefix (e.g., "BG-", "BK-", "RD-", etc.)
  const colorMatch = colorName.match(/^([A-Z]{2})-/);
  if (colorMatch) {
    const colorCode = colorMatch[1];
    const colorMap = {
      'BG': 'Blue Grey',
      'BK': 'Black',
      'RD': 'Red',
      'SK': 'Sky Blue',
      'SL': 'Silver',
      'WT': 'White',
      'GN': 'Green',
      'NA': 'Natural'
    };
    return colorMap[colorCode] || colorCode;
  }
  
  return colorName.split('(')[0] || "Generic Color";
}
