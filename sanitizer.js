#!/usr/bin/env node

/**
 * YAML Sanitizer - Fixes and validates YAML-based system prompt files
 * 
 * This utility handles detecting and repairing duplicate capabilities sections
 * in system prompt files for multiple AI tools, and performs YAML validation.
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const crypto = require("crypto");

// Terminal color constants for better readability
const GREEN = "\x1b[32m";
const BLUE = "\x1b[34m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

/**
 * Supported AI tool directories - easily extend by adding new entries
 */
const SUPPORTED_AI_TOOL_DIRS = [
  ".roo",
  //".cline",
  //".windsurf",
 // ".cursor"
];

/**
 * System prompt file types shared across AI tools
 */
const SYSTEM_PROMPT_FILES = [
  "system-prompt-architect",
  "system-prompt-ask",
  "system-prompt-code",
  "system-prompt-debug",
  "system-prompt-test"
];

/**
 * Generates all permitted file paths by combining tool directories with file types
 * @returns {string[]} Array of allowed file paths
 */
function getAllowedFilePaths() {
  return SUPPORTED_AI_TOOL_DIRS.flatMap(dir => 
    SYSTEM_PROMPT_FILES.map(file => path.join(dir, file))
  );
}

// The complete list of allowed file paths
const ALLOWED_SYSTEM_PROMPT_FILES = getAllowedFilePaths();

/**
 * Validates and sanitizes paths to prevent path traversal attacks
 * @param {string} basePath - Base directory path
 * @param {string} filePath - Relative file path to validate
 * @returns {string|null} Absolute path if valid, null if invalid
 */
function validatePath(basePath, filePath) {
  if (!basePath || !filePath) {
    console.error(`${RED}Security Error${RESET}: Invalid input paths`);
    return null;
  }

  // Normalize and resolve the complete path
  const normalizedBase = path.normalize(basePath);
  const targetPath = path.resolve(normalizedBase, filePath);
  
  // Check if the target path is within the base path (prevent directory traversal)
  if (!targetPath.startsWith(normalizedBase)) {
    console.error(`${RED}Security Error${RESET}: Path traversal attempt detected for ${filePath}`);
    return null;
  }
  
  // Check if the file is in the allowed list (whitelist approach)
  if (!ALLOWED_SYSTEM_PROMPT_FILES.includes(filePath)) {
    console.error(`${RED}Security Error${RESET}: Attempted to access non-allowed file: ${filePath}`);
    return null;
  }
  
  return targetPath;
}

/**
 * Creates a timestamped backup of a file before modification
 * @param {string} filePath - Path to the file
 * @returns {boolean} True if backup was created successfully
 */
function createBackup(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return false;
    }
    
    const backupPath = `${filePath}.bak.${Date.now()}`;
    fs.copyFileSync(filePath, backupPath);
    console.log(`  ${BLUE}Backup${RESET}: Created backup at ${backupPath}`);
    return true;
  } catch (error) {
    console.error(`  ${RED}Error${RESET}: Failed to create backup: ${error.message}`);
    return false;
  }
}

/**
 * Fixes duplicate capabilities sections in system prompt files
 * @param {string} projectRoot - Path to the project root
 * @returns {boolean} True if fixes were successful
 */
function fixDuplicateCapabilities(projectRoot) {
  console.log("\nChecking system prompt files for duplicate capabilities sections...");
  
  // Validate the project root
  if (!projectRoot || !fs.existsSync(projectRoot)) {
    console.error(`${RED}Error${RESET}: Project root path does not exist: ${projectRoot}`);
    return false;
  }
  
  try {
    const stats = fs.statSync(projectRoot);
    if (!stats.isDirectory()) {
      console.error(`${RED}Error${RESET}: Project root path is not a directory: ${projectRoot}`);
      return false;
    }
  } catch (error) {
    console.error(`${RED}Error${RESET}: Failed to check project root: ${error.message}`);
    return false;
  }

  let fixesMade = false;
  let allSuccessful = true;

  // Process each allowed file
  for (const file of ALLOWED_SYSTEM_PROMPT_FILES) {
    const filePath = validatePath(projectRoot, file);
    
    if (!filePath) {
      allSuccessful = false;
      continue;
    }

    if (!fs.existsSync(filePath)) {
      console.log(`  ${BLUE}${file}${RESET}: File not found, skipping`);
      continue;
    }

    try {
      // Read file content safely
      const content = fs.readFileSync(filePath, "utf8");

      // Detect capabilities sections with improved regex that handles whitespace
      const matches = content.match(/^\s*capabilities:/gm);
      if (!matches || matches.length <= 1) {
        console.log(`  ${BLUE}${file}${RESET}: No duplicate capabilities found`);
        continue;
      }

      console.log(`  ${BLUE}${file}${RESET}: Found ${matches.length} capabilities sections`);
      
      // Create a backup before modifying
      if (!createBackup(filePath)) {
        allSuccessful = false;
        continue;
      }

      // Split content into YAML sections
      const sections = splitIntoYamlSections(content);

      // Separate capabilities sections from other content
      const capabilitiesSections = [];
      const otherSections = [];

      sections.forEach((section) => {
        if (section.match(/^\s*capabilities:/mi)) {
          capabilitiesSections.push(section);
        } else {
          otherSections.push(section);
        }
      });

      // Handle multiple capabilities sections
      if (capabilitiesSections.length > 1) {
        let validCapabilitiesSection = null;
        let validIndex = -1;
        
        // Find the first valid capabilities section
        for (let i = 0; i < capabilitiesSections.length; i++) {
          const validationResult = validateYamlSection(capabilitiesSections[i]);
          if (validationResult.valid) {
            validCapabilitiesSection = capabilitiesSections[i];
            validIndex = i;
            break;
          } else {
            console.log(`  ${YELLOW}Warning${RESET}: Section ${i+1} validation error: ${validationResult.error}`);
          }
        }

        if (validCapabilitiesSection) {
          // Find the mode section to insert capabilities after it
          const modeIndex = otherSections.findIndex(s => s.match(/^\s*mode:/mi));
          
          if (modeIndex !== -1) {
            // Construct new content with just one capabilities section
            const newContent = [
              ...otherSections.slice(0, modeIndex + 1),
              validCapabilitiesSection,
              ...otherSections.slice(modeIndex + 1)
            ].join("");

            // Verify changes with checksums
            const originalChecksum = crypto.createHash('sha256').update(content).digest('hex');
            
            // Write fixed content
            fs.writeFileSync(filePath, newContent, "utf8");
            
            // Verify successful write
            const newFileContent = fs.readFileSync(filePath, "utf8");
            const newChecksum = crypto.createHash('sha256').update(newFileContent).digest('hex');
            
            if (originalChecksum !== newChecksum) {
              console.log(`  ${GREEN}Fixed${RESET}: Used capabilities section ${validIndex + 1} in ${BLUE}${file}${RESET}`);
              fixesMade = true;
            } else {
              console.error(`  ${RED}Error${RESET}: File content was not updated for ${BLUE}${file}${RESET}`);
              allSuccessful = false;
            }
          } else {
            console.error(`  ${RED}Error${RESET}: Could not find 'mode:' section in ${BLUE}${file}${RESET}`);
            allSuccessful = false;
          }
        } else {
          console.error(`  ${RED}Error${RESET}: No valid capabilities section found in ${BLUE}${file}${RESET}`);
          allSuccessful = false;
        }
      }
    } catch (error) {
      console.error(`  ${RED}Error${RESET}: Failed to process file ${BLUE}${file}${RESET}: ${error.message}`);
      allSuccessful = false;
    }
  }

  // Report overall results
  if (fixesMade && allSuccessful) {
    console.log(`${GREEN}Fixed duplicate capabilities sections in system prompt files${RESET}`);
  } else if (fixesMade) {
    console.log(`${YELLOW}Warning${RESET}: Fixed some duplicate capabilities sections, but errors occurred`);
  } else {
    console.log("No duplicate capabilities sections found or fixed");
  }

  return allSuccessful;
}

/**
 * Validates system prompt files using js-yaml
 * @param {string} projectRoot - Path to the project root
 * @returns {boolean} True if all files are valid
 */
function validateFilesWithYaml(projectRoot) {
  console.log("\nValidating system prompt files with js-yaml...");
  
  // Validate the project root
  if (!projectRoot || !fs.existsSync(projectRoot)) {
    console.error(`${RED}Error${RESET}: Project root path does not exist: ${projectRoot}`);
    return false;
  }
  
  try {
    if (!fs.statSync(projectRoot).isDirectory()) {
      console.error(`${RED}Error${RESET}: Project root path is not a directory: ${projectRoot}`);
      return false;
    }
  } catch (error) {
    console.error(`${RED}Error${RESET}: Failed to check project root: ${error.message}`);
    return false;
  }

  let allValid = true;

  // Process each allowed file
  for (const file of ALLOWED_SYSTEM_PROMPT_FILES) {
    const filePath = validatePath(projectRoot, file);
    
    if (!filePath) {
      allValid = false;
      continue;
    }

    if (!fs.existsSync(filePath)) {
      console.log(`  ${BLUE}${file}${RESET}: File not found, skipping`);
      continue;
    }

    try {
      // Read file content
      const content = fs.readFileSync(filePath, "utf8");

      // Check for duplicate capabilities sections
      const matches = content.match(/^\s*capabilities:/gm);
      if (matches && matches.length > 1) {
        console.log(`  ${YELLOW}Warning${RESET}: ${BLUE}${file}${RESET} still has ${matches.length} capabilities sections`);
        allValid = false;
        continue;
      }

      // Split into sections
      const sections = splitIntoYamlSections(content);

      // Validate each section
      let invalidSections = 0;

      for (const section of sections) {
        // Only validate sections that look like YAML
        if (section.includes(":")) {
          const validationResult = validateYamlSection(section);
          
          if (!validationResult.valid) {
            invalidSections++;
            console.log(`  ${YELLOW}Warning${RESET}: Invalid YAML in section: ${section.substring(0, 40).replace(/\n/g, "\\n")}...`);
            console.log(`    Error: ${validationResult.error}`);
          }
        }
      }

      // Report validation results for this file
      if (invalidSections > 0) {
        console.log(`  ${YELLOW}Warning${RESET}: ${BLUE}${file}${RESET} has ${invalidSections} sections with YAML errors`);
        allValid = false;
      } else {
        console.log(`  ${GREEN}Valid${RESET}: ${BLUE}${file}${RESET} - All YAML sections validated successfully`);
      }
    } catch (error) {
      console.error(`  ${RED}Error${RESET}: Failed to process file ${BLUE}${file}${RESET}: ${error.message}`);
      allValid = false;
    }
  }

  // Report overall validation results
  if (allValid) {
    console.log(`${GREEN}All system prompt files validated successfully${RESET}`);
  } else {
    console.log(`${YELLOW}Warning${RESET}: Some files have issues that need attention`);
  }

  return allValid;
}

/**
 * Splits content into YAML sections using structure awareness
 * @param {string} content - File content
 * @returns {string[]} Array of sections
 */
function splitIntoYamlSections(content) {
  if (!content) return [];
  
  const sections = [];
  let currentSection = "";
  let inYamlBlock = false;

  const lines = content.split("\n");
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Skip empty lines between sections
    if (!currentSection && trimmedLine === "") {
      continue;
    }
    
    // Detect new section (unindented line)
    if (trimmedLine !== "" && !line.match(/^\s+/) && !inYamlBlock) {
      // Save previous section before starting a new one
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = line + "\n";
      
      // Mark start of YAML block if this looks like a YAML property
      if (line.includes(":")) {
        inYamlBlock = true;
      }
    } else if (inYamlBlock && trimmedLine !== "" && !line.match(/^\s+/)) {
      // Found a new unindented line while in a YAML block - it's a new section
      inYamlBlock = false;
      sections.push(currentSection);
      currentSection = line + "\n";
      
      // Check if new section starts a YAML block
      if (line.includes(":")) {
        inYamlBlock = true;
      }
    } else {
      // Continue current section
      currentSection += line + "\n";
    }
  }

  // Add the last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Validates a YAML section with safe parsing
 * @param {string} section - Section content to validate
 * @returns {Object} Result with valid flag and error message
 */
function validateYamlSection(section) {
  if (!section || !section.includes(":")) {
    return { valid: true, error: null };
  }
  
  try {
    // Handle different YAML formats safely
    if (section.trim().startsWith("---") || !section.trim().match(/^\w+:/)) {
      // Looks like a complete YAML document
      yaml.load(section);
    } else {
      // For YAML fragments, wrap with a temporary root element
      const yamlStr = `temp_root:\n${section.split("\n").map(line => `  ${line}`).join("\n")}`;
      yaml.load(yamlStr);
    }
    return { valid: true, error: null };
  } catch (yamlError) {
    return { valid: false, error: yamlError.message };
  }
}

// Export public API
module.exports = {
  // Main functions
  fixDuplicateCapabilities,
  validateFilesWithYaml,
  
  // Helper functions (exported for testing)
  validatePath,
  createBackup,
  splitIntoYamlSections,
  validateYamlSection,
  
  // Configuration constants
  SUPPORTED_AI_TOOL_DIRS,
  SYSTEM_PROMPT_FILES,
  ALLOWED_SYSTEM_PROMPT_FILES
};