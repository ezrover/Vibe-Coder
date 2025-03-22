#!/usr/bin/env node

/**
 * RooFlow Installer
 * =====================================
 *
 * This script installs and configures RooFlow and other compatible AI assistant tools
 * for VS Code development environments. It performs the following tasks:
 *
 * 1. Copies configuration files from local template folders
 * 2. Creates the necessary directory structure for multiple AI tools
 * 3. Validates YAML structure in system prompt files
 * 4. Fixes common issues like duplicate capabilities sections
 * 5. Sets up environment variables using insert-variables scripts
 *
 * The installer supports multiple AI tool directories (.roo, .cline, .windsurf, .cursor)
 * and maintains compatibility with their specific configuration requirements.
 *
 * Author: Ardumotion
 * License: MIT
 */

const https = require('https');
const AdmZip = require('adm-zip');
const fs = require("fs");
const path = require("path");
const os = require('os');
const { execSync } = require("child_process");
const sanitizerScript = require("./sanitizer"); // Import our YAML sanitizer module

// Terminal color constants for better readability in console output
const GREEN = "\x1b[32m"; // Success messages
const BLUE = "\x1b[34m"; // Informational highlights
const YELLOW = "\x1b[33m"; // Warnings
const RED = "\x1b[31m"; // Errors
const RESET = "\x1b[0m"; // Reset color


const projectRoot = findProjectRoot();

let rooFlowPath = path.join(projectRoot, 'RooFlow', 'RooFlow-main', 'config');

// Import AI tool directories from yaml-sanitizer module
// These define which AI assistant tools we support
const AI_TOOL_DIRS = sanitizerScript.SUPPORTED_AI_TOOL_DIRS;
const SYSTEM_PROMPT_FILES = sanitizerScript.SYSTEM_PROMPT_FILES;

/**
 * Template directories for each AI tool
 * -------------------------------------
 * These are the source folders containing template files for each AI tool.
 * Each folder should contain the necessary configuration files for that tool.
 */
const AI_IDE_DIRECTORIES = {
  ".roo": path.join(projectRoot, "RooFlow", 'RooFlow-main', "config", ".roo"),
  "common": path.join(projectRoot, "RooFlow", 'RooFlow-main', "config"),
  //".cline": path.join(__dirname, "templates", "cline"),
  //".windsurf": path.join(__dirname, "templates", "windsurf"),
  //".cursor": path.join(__dirname, "templates", "cursor"),
};

// Installation context information - useful for debugging and diagnostics
const isPostinstall = process.env.npm_lifecycle_event === "postinstall";

/**
 * Generates the list of files to copy based on supported AI tools
 * ---------------------------------------------------------------------
 * This function dynamically builds a copy manifest based on which AI tools
 * are supported. For each tool directory (.roo, .cline, etc.), it adds the
 * appropriate system prompt files. For .roo (primary tool), it also adds
 * the .roomodes configuration file.
 *
 * @returns {Array} Array of file objects with src and dest properties
 *                  - src: Path in the local template directory
 *                  - dest: Destination path in the user's project
 */
function getFilesToCopy() {
  const files = [];

  // Add common files first (shared across all tools)
  files.push(
    { src: path.join(projectRoot, 'RooFlow', 'RooFlow-main', "config", ".rooignore"), dest: ".rooignore" },
    { src: path.join(projectRoot, 'RooFlow', 'RooFlow-main', "config", ".roomodes"), dest: ".roomodes" },
    { src: path.join(projectRoot, 'RooFlow', 'RooFlow-main',  "config", "insert-variables.cmd"), dest: "insert-variables.cmd" },
    { src: path.join(projectRoot, 'RooFlow', 'RooFlow-main', "config", "insert-variables.sh"), dest: "insert-variables.sh" }
  );

  // Add files for each AI tool directory
  AI_TOOL_DIRS.forEach((dir) => {
    const templateDir = path.join(projectRoot, 'RooFlow', 'RooFlow-main', "config", dir);
    console.log(`${YELLOW}Info${RESET}: template directory: ${templateDir}`);

    // Skip if no template directory exists for this tool
    if (!templateDir || !fs.existsSync(templateDir)) {
      console.log(`${YELLOW}Warning${RESET}: No template directory found for ${dir}`);
      return;
    }

    // Add modes file for each tool
    const modesFile = `${dir}modes`;
    const modesPath = path.join(templateDir, modesFile.substring(1)); // Remove the dot for the source path

    if (fs.existsSync(modesPath)) {
      files.push({ src: modesPath, dest: modesFile });
    } else if (dir === ".roo") {
      // .roomodes is required for the primary tool
      console.log(`${YELLOW}Warning${RESET}: Required modes file missing for ${dir}`);
    }

    // Add system prompt files for each AI tool
    SYSTEM_PROMPT_FILES.forEach((file) => {
      const srcPath = path.join(templateDir, file);
      const destPath = path.join(dir, file);

      // Only add the file if it exists in the template directory
      if (fs.existsSync(srcPath)) {
        files.push({ src: srcPath, dest: destPath });
      } else {
        console.log(`${YELLOW}Warning${RESET}: Template file ${file} missing for ${dir}`);
      }
    });
  });

  return files;
}

/**
 * Finds the root directory of the project
 * ----------------------------------------
 * This function uses multiple strategies to determine the project root:
 * 1. First checks npm environment variables (most reliable)
 * 2. Then checks if running from within node_modules (common for npm scripts)
 * 3. Falls back to current working directory (for direct executions)
 *
 * Havingthe correct project root is crucial for installing files in the right location.
 * 
 * @returns {string} Path to the project root
 */
function findProjectRoot() {
  // Most important: If we're being run as part of npm install in a directory,
  // npm sets npm_config_local_prefix to that directory
  if (process.env.npm_config_local_prefix) {
    return process.env.npm_config_local_prefix;
  }

  // Check for test directory pattern in parent directories
  let currentDir = process.cwd();
  while (currentDir !== path.dirname(currentDir)) {
    if (path.basename(currentDir).startsWith('vibecoder-tests-')) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // Next check if we're being run from within node_modules
  if (process.cwd().includes("node_modules")) {
    // For any execution from within node_modules, use the parent project directory
    return path.resolve(process.cwd(), "..", "..");
  }

  // For direct runs, use current working directory
  return process.cwd();
}

/**
 * Creates necessary directories for all supported AI tools
 * --------------------------------------------------------
 * This function ensures all the directory structures required by
 * different AI assistant tools exist before attempting to copy files.
 * It creates these directories if they don't already exist.
 *
 * @param {string} projectRoot - Path to the project root
 */
function createToolDirectories(projectRoot) {
  console.log("Creating AI tool directories...");

  AI_TOOL_DIRS.forEach((dir) => {
    const dirPath = path.join(projectRoot, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`  Created ${BLUE}${dir}${RESET} directory`);
    } else {
      console.log(`  ${BLUE}${dir}${RESET} directory already exists`);
    }
  });
}

/**
 * Copies a file from template directory to the project
 * ------------------------------------------------------
 * This function handles copying a file from the local template directory
 * to the appropriate location in the project. It creates any necessary
 * directories and handles various error conditions.
 *
 * @param {string} srcPath - Source path in the template directory
 * @param {string} destPath - Destination path in the project
 * @returns {Promise} Promise that resolves to true if successful, false if file not found
 */
function copyFile(srcPath, destPath) {
  return new Promise((resolve, reject) => {
    // Check if source file exists
    if (!fs.existsSync(srcPath)) {
      console.log(`  ${YELLOW}Warning${RESET}: Source file not found at ${srcPath}`);
      resolve(false);
      return;
    }

    console.log(`  Copying ${BLUE}${srcPath}${RESET} to ${destPath}...`);

    const destFullPath = path.join(projectRoot, destPath);

    // Create directories if they don't exist
    const destDir = path.dirname(destFullPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    console.log(`  Copying ${BLUE}${destPath}${RESET}...`);

    try {
      // Perform the file copy
      fs.copyFileSync(srcPath, destFullPath);
      resolve(true);
    } catch (error) {
      reject(new Error(`Failed to copy ${srcPath} to ${destFullPath}: ${error.message}`));
    }
  });
}

/**
 * Run insert-variables script to configure the environment
 * --------------------------------------------------------
 * This function executes the platform-appropriate script to set up
 * environment variables. It handles both Windows and Unix-like platforms,
 * with fallback mechanisms for Windows to try both bash and cmd options.
 *
 * The insert-variables scripts set up project-specific placeholders in
 * the system prompt files for personalization.
 *
 * @returns {boolean} True if script ran successfully
 */
function runInsertVariablesScript() {
  console.log("\nRunning insert-variables script to configure system variables...");

  const isWindows = process.platform === "win32";
  const projectRoot = findProjectRoot();

  try {
    if (isWindows) {
      // Windows systems - try Git Bash first, fall back to cmd script
      try {
        // Make sure shell script is executable
        fs.chmodSync(path.join(projectRoot, "insert-variables.sh"), "755");
        // Try to run with bash (for Git Bash or WSL)
        execSync("bash ./insert-variables.sh", {
          cwd: projectRoot,
          stdio: "inherit",
        });
      } catch (err) {
        // Fallback to cmd script if bash fails
        console.log(`  ${YELLOW}Bash execution failed, trying Windows cmd script...${RESET}`);
        execSync("insert-variables.cmd", {
          cwd: projectRoot,
          stdio: "inherit",
        });
      }
    } else {
      // For Unix-like systems (Linux, macOS)
      fs.chmodSync(path.join(projectRoot, "insert-variables.sh"), "755");
      execSync("./insert-variables.sh", {
        cwd: projectRoot,
        stdio: "inherit",
      });
    }
    return true;
  } catch (error) {
    console.error(`${RED}Failed to run insert-variables script${RESET}`);
    console.error("You may need to run it manually:");
    console.error(
      isWindows
        ? "  insert-variables.cmd or bash ./insert-variables.sh"
        : "  ./insert-variables.sh"
    );
    return false;
  }
}

/**
 * Cleanup temporary installation files
 * ------------------------------------
 * This function removes the insert-variables scripts after successful
 * installation, as they're only needed during the setup process.
 * These scripts contain sensitive information like placeholders,
 * so they should be removed after setup is complete.
 *
 * @returns {void}
 */
function cleanupInsertVariablesScripts() {
  console.log("\nCleaning up insert-variables scripts...");
  const projectRoot = findProjectRoot();

  try {
    const cmdPath = path.join(projectRoot, "insert-variables.cmd");
    const shPath = path.join(projectRoot, "insert-variables.sh");

    // Remove Windows cmd script if it exists
    if (fs.existsSync(cmdPath)) {
      fs.unlinkSync(cmdPath);
      console.log(`  Removed ${BLUE}insert-variables.cmd${RESET}`);
    }

    // Remove bash shell script if it exists
    if (fs.existsSync(shPath)) {
      fs.unlinkSync(shPath);
      console.log(`  Removed ${BLUE}insert-variables.sh${RESET}`);
    }

    console.log(`${GREEN}Cleanup completed successfully${RESET}`);
  } catch (error) {
    console.error(`${YELLOW}Warning: Failed to clean up insert-variables scripts${RESET}`);
    console.error(`  Error: ${error.message}`);
    console.error("  You may want to delete these files manually for security reasons.");
  }
}

/**
 * Validates all system prompt files across all AI tools
 * -----------------------------------------------------
 * This function runs the YAML sanitizer on all system prompt files
 * to ensure they have valid YAML structure and no duplicate sections.
 * First, it attempts to fix any duplicate capabilities sections,
 * then it validates the resulting YAML structure.
 *
 * @returns {boolean} True if all validations passed
 */
function validateAllToolConfigurations() {
  let allValid = true;

  // First attempt to fix any duplicate capabilities sections
  // This is a common issue when updating from older versions
  console.log("\nChecking and fixing system prompt files...");
  const fixResult = sanitizerScript.fixDuplicateCapabilities(findProjectRoot());

  if (!fixResult) {
    console.log(`${YELLOW}Warning: Some issues could not be automatically fixed${RESET}`);
    allValid = false;
  }

  // Then validate YAML structure across all files
  console.log("\nValidating YAML structure in all configuration files...");
  const validationSuccess = sanitizerScript.validateFilesWithYaml(findProjectRoot());

  if (!validationSuccess) {
    console.log(`${YELLOW}Warning: YAML validation detected issues${RESET}`);
    allValid = false;
  }

  return allValid;
}

/**
 * Verifies that template directories exist
 * ----------------------------------------
 * This function checks if the necessary template directories exist
 * before starting the installation process.
 *
 * @returns {boolean} True if template directories exist
 */
function verifyTemplateDirectories() {
  console.log("Verifying template directories...");
  let valid = true;

  // Check if common templates exist (required)
  if (!fs.existsSync(AI_IDE_DIRECTORIES.common)) {
    console.error(`${RED}Error: Common template directory not found at ${AI_IDE_DIRECTORIES.common}${RESET}`);
    valid = false;
  } else {
    console.log(`  ${GREEN}Found common templates${RESET}`);
  }

  // Check tool-specific templates
  let foundAny = false;
  AI_TOOL_DIRS.forEach((dir) => {
    const ideDir = AI_IDE_DIRECTORIES[dir];
    if (!ideDir) {
      console.log(`  ${YELLOW}Warning: No template directory found for ${ideDir}${RESET}`);
      return;
    }
    if (fs.existsSync(ideDir)) {
      console.log(`  ${GREEN}Found templates for ${ideDir}${RESET}`);
      foundAny = true;
    } else {
      console.log(`  ${YELLOW}Warning: No templates found for ${ideDir}${RESET}`);
    }
  });

  if (!foundAny) {
    console.error(`${RED}Error: No tool-specific template directories found${RESET}`);
    valid = false;
  }

  return valid;
}

/**
 * Main installation function
 * --------------------------
 * This is the core function that orchestrates the entire installation process.
 * It handles directory creation, file copies, script execution, YAML validation,
 * and provides appropriate feedback to the user throughout the process.
 */
async function install() {
  console.log(`${BLUE}RooFlow Installer${RESET}`);


  // Print installation context information (useful for debugging)
  console.log(`Installation details:`);
  console.log(`- Script directory: ${__dirname}`);
  console.log(`- Target directory: ${projectRoot}`);
  console.log(`- RooFlow directories: ${rooFlowPath}`);
  console.log(`- Running as postinstall: ${isPostinstall ? "Yes" : "No"}`);
  console.log(`- Supported AI tools: ${AI_TOOL_DIRS.join(", ")}\n`);

  // Download and unpack RooFlow
  // Create RooFlow directory if it doesn't exist
  if (!fs.existsSync(rooFlowPath)) {
    fs.mkdirSync(rooFlowPath, { recursive: true });
    console.log('Created RooFlow config directory');
  }
  console.log('Downloading and unpacking RooFlow...');
  const zipUrl = 'https://codeload.github.com/GreatScottyMac/RooFlow/zip/refs/heads/main';

  const zipPath = path.join(projectRoot, 'RooFlow.zip');
  const extractPath = path.join(projectRoot, 'RooFlow');

  try {
    console.log(`Downloading RooFlow from ${zipUrl} to ${zipPath}`);
    await new Promise((resolve, reject) => {
      https.get(zipUrl, (res) => {
        if (res.statusCode === 302) {
          // Handle redirect
          const redirectUrl = res.headers.location;
          console.log(`Redirecting to ${redirectUrl}`);
          https.get(redirectUrl, (redirectRes) => {
            if (redirectRes.statusCode !== 200) {
              reject(new Error(`Failed to download RooFlow.zip after redirect: HTTP ${redirectRes.statusCode}`));
              return;
            }
            const file = fs.createWriteStream(zipPath);
            redirectRes.pipe(file);
            file.on('finish', () => {
              file.close();
              console.log('Downloaded RooFlow.zip successfully');
              resolve();
            });
          }).on('error', (redirectErr) => {
            fs.unlinkSync(zipPath);
            console.error('Error downloading RooFlow.zip after redirect:', redirectErr.message);
            reject(redirectErr);
          });
        } else if (res.statusCode !== 200) {
          reject(new Error(`Failed to download RooFlow.zip: HTTP ${res.statusCode}`));
          return;
        } else {
          const file = fs.createWriteStream(zipPath);
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log('Downloaded RooFlow.zip successfully');
            resolve();
          });
        }
      }).on('error', (err) => {
        fs.unlinkSync(zipPath);
        console.error('Error downloading RooFlow.zip:', err.message);
        reject(err);
      });
    });

    console.log(`Extracting RooFlow.zip to ${extractPath}`);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);
    console.log('Unpacked RooFlow.zip to RooFlow folder successfully');
    fs.unlinkSync(zipPath);
    console.log('Deleted RooFlow.zip successfully');

    // Check if RooFlow/config directory exists after extraction
    if (!fs.existsSync(rooFlowPath)) {
      console.error('Error: RooFlow/config directory not found after extraction');
    }
  } catch (error) {
    console.error(`Error downloading and unpacking RooFlow: ${error.message}. Stack: ${error.stack}`);
  }

  // Verify template directories exist
  if (!verifyTemplateDirectories()) {
    console.error(`${RED}Installation cannot proceed due to missing template directories${RESET}`);
    return false;
  }

  // Create tool directories for all supported AI assistants
  // Create RooFlow directory if it doesn't exist
  if (!fs.existsSync(rooFlowPath)) {
    fs.mkdirSync(rooFlowPath, { recursive: true });
    console.log('Created RooFlow config directory');
  }

  createToolDirectories(rooFlowPath);

  // Get list of files to copy based on supported tools
  const FILES = getFilesToCopy();

  // Copy all files from templates
  console.log("Copying template files...");
  let copySuccess = true;

  try {
    // Process each file in the copy list
    for (const file of FILES) {
      const success = await copyFile(file.src, file.dest);

      if (!success) {
        console.log(`  ${YELLOW}Warning: Failed to copy ${file.src}${RESET}`);
        if (file.dest.includes("modes")) {
          console.log(`  ${YELLOW}Note: Missing modes file for ${path.dirname(file.dest)}${RESET}`);
        }
        copySuccess = false;
      }
    }

    // Report copy results
    if (copySuccess) {
      console.log(`\n${GREEN}All required files copied successfully${RESET}`);
    } else {
      console.log(`\n${YELLOW}Warning: Some files could not be copied${RESET}`);
      console.log("Installation will continue with available files.");
    }

    // Make shell script executable on Unix-like systems
    if (process.platform !== "win32") {
      fs.chmodSync(path.join(findProjectRoot(), "insert-variables.sh"), "755");
    }

    // Run setup scripts and validate configurations
    const scriptSuccess = runInsertVariablesScript();
    const validationSuccess = validateAllToolConfigurations();

    if (scriptSuccess) {
      // Clean up temporary files after successful setup
      cleanupInsertVariablesScripts();

      if (validationSuccess) {
        // Report successful installation
        console.log(`\n${GREEN}Installation complete!${RESET}`);
        console.log("Your project is now configured to use the following AI tools:");

        AI_TOOL_DIRS.forEach((dir) => {
          console.log(`  ${BLUE}${dir}${RESET} - Contains system prompt files for ${dir.substring(1)}`);
        });

        console.log("\nDirectory structure created:");
        AI_TOOL_DIRS.forEach((dir) => {
          console.log(`  ${dir}/ - System prompt files`);
          if (dir === ".roo") {
            console.log("  .roomodes - Mode configuration file for RooFlow");
          }
        });

        console.log("\nThe memory-bank directory will be created automatically when you first use the AI tools.");
        console.log("\nTo start using RooFlow (primary tool):");
        console.log("  1. Open your project in VS Code");
        console.log("  2. Ensure the Roo Code extension is installed");
        console.log('  3. Start a new Roo Code chat and say "Hello"');
      } else {
        // Installation completed but with warnings
        console.log(`\n${YELLOW}Installation completed with warnings${RESET}`);
        console.log("Some system prompt files may have YAML issues that need manual attention.");
        console.log("Your project is configured, but you may encounter issues.");
        console.log("\nTo fix YAML issues, you can run the validation again:");
        console.log("  node node_modules/vibecoder/sanitizer.js");
      }

      // Provide recovery options for any issues
      console.log("\nIf you have any issues with automatic installation, you can always:");
      console.log('- Run "npm run setup" in your project');
      console.log('- Run "node node_modules/vibecode/installer.js" directly');
    } else {
      // Script execution failed
      console.error(`\n${RED}Installation encountered issues${RESET}`);
      console.error("The insert-variables script failed to run.");
      console.error("You may need to run it manually:");
      console.error(
        process.platform === "win32"
          ? "  insert-variables.cmd or bash ./insert-variables.sh"
          : "  ./insert-variables.sh"
      );
    }
  } catch (error) {
    // Handle any unexpected errors
    console.error(`${RED}Error during installation:${RESET}`, error.message);
    process.exit(1);
  }
}

// Add error handler for better diagnostic information
process.on("uncaughtException", (error) => {
  console.error(`${RED}Installer encountered an error:${RESET}`);
  console.error(error);
  console.error("\nIf installation failed, you can run it manually:");
  console.error("- npm run setup");
  console.error("- node node_modules/vibecoder/install.js");
  process.exit(1);
});

// Run the installation
console.log("Installer running...");
install().catch((error) => {
  console.error(`${RED}Installation failed:${RESET}`, error);
  process.exit(1);
});