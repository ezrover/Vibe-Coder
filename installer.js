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

const https = require("https");
const AdmZip = require("adm-zip");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
const sanitizerScript = require("./sanitizer"); // Import our YAML sanitizer module

// Terminal color constants for better readability in console output
const GREEN = "\x1b[32m"; // Success messages
const BLUE = "\x1b[34m"; // Informational highlights
const YELLOW = "\x1b[33m"; // Warnings
const RED = "\x1b[31m"; // Errors
const RESET = "\x1b[0m"; // Reset color

const projectRoot = findProjectRoot();
const isPostinstall = process.env.npm_lifecycle_event === "postinstall";

const AI_IDE_EXTENSIONS = {
  ".roo": {
    url: "https://codeload.github.com/GreatScottyMac/RooFlow/zip/refs/heads/main",
    templateDir: path.join(projectRoot, "roo", "RooFlow-main", "config", ".roo"),
    filesToCopy: [
      {src: path.join(projectRoot, "roo", "RooFlow-main", "config", ".roo", "system-prompt-architect"), destFolder: path.join(".roo", "system-prompt-architect.yaml"), overwritePermission: true},
      {src: path.join(projectRoot, "roo", "RooFlow-main", "config", ".roo", "system-prompt-ask"), destFolder: path.join(".roo", "system-prompt-ask.yaml"), overwritePermission: true},
      {src: path.join(projectRoot, "roo", "RooFlow-main", "config", ".roo", "system-prompt-code"), destFolder: path.join(".roo", "system-prompt-code.yaml"), overwritePermission: true},
      {src: path.join(projectRoot, "roo", "RooFlow-main", "config", ".roo", "system-prompt-debug"), destFolder: path.join(".roo", "system-prompt-debug.yaml"), overwritePermission: true},
      {src: path.join(projectRoot, "roo", "RooFlow-main", "config", ".roo", "system-prompt-test"), destFolder: path.join(".roo", "system-prompt-test.yaml"), overwritePermission: true},

      {src: path.join(projectRoot, "roo", "RooFlow-main", "default-system-prompt.md"), destFolder: path.join(".roo", "system-prompt-default.md"), overwritePermission: false},

      {src: path.join(projectRoot, "roo", "RooFlow-main", "config", "default-mode", "cline_custom_modes.json"), destFolder: path.join(".roo", "cline_custom_modes.json"), overwritePermission: true},
      {src: path.join(projectRoot, "roo", "RooFlow-main", "config", "default-mode", "custom-instructions.yaml"), destFolder: path.join(".roo", "custom-instructions.yaml"), overwritePermission: true},
      {src: path.join(projectRoot, "roo", "RooFlow-main", "config", "default-mode", "README.md"), destFolder: path.join(".roo", "README.md"), overwritePermission: true},
      {src: path.join(projectRoot, "roo", "RooFlow-main", "config", "default-mode", "role-definition.txt"), destFolder: path.join(".roo", "role-definition.txt"), overwritePermission: true},
    ],
    additionalFilesToCopy: [
      {src: path.join(projectRoot, "roo", "RooFlow-main", "config", ".rooignore"), dest: ".rooignore", overwritePermission: false},
      {src: path.join(projectRoot, "roo", "RooFlow-main", "config", ".roomodes"), dest: ".roomodes", overwritePermission: true},

      {src: path.join(projectRoot, "roo", "RooFlow-main", "config", "insert-variables.cmd"), dest: "insert-variables.cmd", overwritePermission: true},
      {src: path.join(projectRoot, "roo", "RooFlow-main", "config", "insert-variables.sh"), dest: "insert-variables.sh", overwritePermission: true},
    ],
  },
  ".cline": {
    url: "https://codeload.github.com/GreatScottyMac/roo-code-memory-bank/zip/refs/heads/main",
    templateDir: path.join(projectRoot, "cline", "roo-code-memory-bank-main"),
    filesToCopy: [
      {src: path.join(projectRoot, "cline", "roo-code-memory-bank-main", ".clinerules-architect"), destFolder: path.join( ".clinerules-architect"), overwritePermission: true},
      {src: path.join(projectRoot, "cline", "roo-code-memory-bank-main", ".clinerules-code"), destFolder: path.join( ".clinerules-code"), overwritePermission: true},
      {src: path.join(projectRoot, "cline", "roo-code-memory-bank-main", ".clinerules-ask"), destFolder: path.join( ".clinerules-ask"), overwritePermission: true},
      {src: path.join(projectRoot, "clione", "roo-code-memory-bank-main", ".clinerules-debug"), destFolder: path.join( ".clinerules-debug"), overwritePermission: true},
      {src: path.join(projectRoot, "cline", "roo-code-memory-bank-main", ".clinerules-test"), destFolder: path.join( ".clinerules-test"), overwritePermission: true},
      {src: path.join(projectRoot, "cline", "roo-code-memory-bank-main", ".roomodes"), destFolder: path.join( ".roomodes"), overwritePermission: true},
    ],
    additionalFilesToCopy: [],
  },
  ".windsurf": {
    url: "https://codeload.github.com/GreatScottyMac/cascade-memory-bank/zip/refs/heads/main",
    templateDir: path.join(projectRoot, "windsurf", "cascade-memory-bank-main"),
    filesToCopy: [
      {src: path.join(projectRoot, "windsurf", "cascade-memory-bank-main", ".windsurfrules"), destFolder: path.join( ".windsurfrules"), overwritePermission: true},
      {src: path.join(projectRoot, "windsurf", "cascade-memory-bank-main", "global_rules.md"), dest: path.join(os.homedir(), ".codeium", "windsurf", "memories", "global_rules.md"), isAbsolutePath: true, overwritePermission: true},
    ],
    additionalFilesToCopy: [],
  },
  ".cursor": {
    url: null,
    configPath: null,
    templateDir: null, // Placeholder for future template directory
    filesToCopy: [],
    additionalFilesToCopy: [],
  },
  ".gitlab-copilot": {
    url: null,
    templateDir: null, // Placeholder for future template directory
    filesToCopy: [],
    additionalFilesToCopy: [],
  },
};

// Consolidated global data for AI IDE extensions
const AI_TOOL_DIRS = Object.keys(AI_IDE_EXTENSIONS);

/**
 * Generates the list of files to copy based on supported AI tools
 * ---------------------------------------------------------------------
 * Updated to handle the new structure of filesToCopy with destFolder.
 */
function getFilesToCopy() {
  const files = [];

  // Add additional files for each AI tool
  AI_TOOL_DIRS.forEach((dir) => {
    const {
      url,
      templateDir,
      additionalFilesToCopy,
      filesToCopy,
    } = AI_IDE_EXTENSIONS[dir];

    // Skip processing if the URL is null
    if (!url) {
      console.log(`${YELLOW}Info${RESET}: Skipping ${dir} as it has no URL.`);
      return;
    }

    console.log(`${YELLOW}Info${RESET}: template directory: ${templateDir}`);

    // Add additional files to the copy list
    if (additionalFilesToCopy) {
      files.push(...additionalFilesToCopy);
    }

    // Skip if no template directory exists for this tool
    if (url !== null && (!templateDir || !fs.existsSync(templateDir))) {
      console.log(
        `${YELLOW}Warning${RESET}: No template directory found for ${dir}`
      );
      return;
    }

    // Add filesToCopy for each tool
    filesToCopy.forEach(({ src, dest, destFolder, isAbsolutePath }) => {
      if (fs.existsSync(src)) {
        if (dest) {
          // If dest is directly provided, use it
          files.push({ src, dest, isAbsolutePath });
        } else if (destFolder) {
          console.log(`${YELLOW}Note${RESET}: Using deprecated 'destFolder' property for: ${src}`);
          files.push({ src, dest: destFolder, isAbsolutePath });
        } else {
          console.log(`${YELLOW}Warning${RESET}: Destination is undefined for source file: ${src}`);
        }
      } else {
        console.log(`${YELLOW}Warning${RESET}: Source file does not exist: ${src} for tool: ${dir}`);
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
    if (path.basename(currentDir).startsWith("vibecoder-tests-")) {
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
/**
 * Copies a file from template directory to the project or an absolute path
 * ------------------------------------------------------
 * This function handles copying a file from the local template directory
 * to the appropriate location in the project or to an absolute path.
 * It creates any necessary directories and handles various error conditions.
 * If the destination file already exists, it will not overwrite it.
 *
 * @param {string} srcPath - Source path in the template directory
 * @param {string} destPath - Destination path (relative to projectRoot or absolute)
 * @param {boolean} isAbsolutePath - Whether destPath is an absolute path
 * @param {boolean} forceOverwrite - Whether to overwrite existing files (default: false)
 * @returns {Promise} Promise that resolves to true if successful, false if file not found or skipped
 */
function copyFile(srcPath, destPath, isAbsolutePath = false, forceOverwrite = false) {
  return new Promise((resolve, reject) => {
    // Check if source file exists
    if (!fs.existsSync(srcPath)) {
      console.log(
        `  ${YELLOW}Warning${RESET}: Source file not found at ${srcPath}`
      );
      resolve(false);
      return;
    }

    // Determine the full destination path based on whether it's absolute or relative
    const destFullPath = isAbsolutePath ? destPath : path.join(projectRoot, destPath);

    // Check if destination file already exists
    if (fs.existsSync(destFullPath) && !forceOverwrite) {
      console.log(`  ${BLUE}Skipping${RESET}: File already exists at ${destFullPath}`);
      console.log(`  ${YELLOW}Note${RESET}: Preserving user modifications`);
      resolve(true); // Still return true as this is an expected condition
      return;
    }

    console.log(`  Copying ${BLUE}${srcPath}${RESET} to ${destPath} ...`);

    // Create directories if they don't exist
    const destDir = path.dirname(destFullPath);
    if (!fs.existsSync(destDir)) {
      try {
        fs.mkdirSync(destDir, { recursive: true });
        console.log(`  Created directory: ${destDir}`);
      } catch (dirError) {
        console.error(`  ${RED}Error${RESET}: Failed to create directory ${destDir}: ${dirError.message}`);
        resolve(false);
        return;
      }
    }

    try {
      // Perform the file copy
      fs.copyFileSync(srcPath, destFullPath);
      console.log(`  Successfully copied to ${destFullPath}`);
      resolve(true);
    } catch (error) {
      reject(
        new Error(
          `Failed to copy ${srcPath} to ${destFullPath}: ${error.message}`
        )
      );
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
  console.log(
    "\nRunning insert-variables script to configure system variables ..."
  );

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
        console.log(
          `  ${YELLOW}Bash execution failed, trying Windows cmd script...${RESET}`
        );
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
    console.error(
      `${YELLOW}Warning: Failed to clean up insert-variables scripts${RESET}`
    );
    console.error(`  Error: ${error.message}`);
    console.error(
      "  You may want to delete these files manually for security reasons."
    );
  }
}

/**
 * Cleanup downloaded zip files and extracted extension directories
 * ------------------------------------------------------------
 * This function removes temporary zip files and extracted directories
 * for AI IDE extensions after successful installation.
 *
 * @returns {void}
 */
function cleanupDownloadedExtensions() {
  console.log("\nCleaning up downloaded AI extension files...");
  
  try {
    AI_TOOL_DIRS.forEach((extension) => {
      // Skip if no URL (no download occurred)
      if (!AI_IDE_EXTENSIONS[extension].url) return;

      const zipPath = path.join(projectRoot, `${extension.substring(1)}.zip`);
      const extractPath = path.join(projectRoot, extension.substring(1));

      // Remove zip file if it still exists
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
        console.log(`  Removed ${BLUE}${extension.substring(1)}.zip${RESET}`);
      }

      // Remove extracted directory if it exists
      if (fs.existsSync(extractPath)) {
        fs.rmSync(extractPath, { recursive: true, force: true });
        console.log(`  Removed ${BLUE}${extension.substring(1)} directory${RESET}`);
      }
    });

    console.log(`${GREEN}Extension cleanup completed successfully${RESET}`);
  } catch (error) {
    console.error(
      `${YELLOW}Warning: Failed to clean up downloaded extension files${RESET}`
    );
    console.error(`  Error: ${error.message}`);
    console.error(
      "  You may want to manually remove any remaining .zip files or extension directories."
    );
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
  console.log("\nChecking and fixing system prompt files ...");
  const fixResult = sanitizerScript.fixDuplicateCapabilities(findProjectRoot());

  if (!fixResult) {
    console.log(
      `${YELLOW}Warning: Some issues could not be automatically fixed${RESET}`
    );
    allValid = false;
  }

  // Then validate YAML structure across all files
  console.log("\nValidating YAML structure in all configuration files ...");
  const validationSuccess = sanitizerScript.validateFilesWithYaml(
    findProjectRoot()
  );

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
  console.log("Verifying template directories ...");
  let valid = true;

  // Check tool-specific templates
  let foundAny = false;
  AI_TOOL_DIRS.forEach((dir) => {
    const ideDir = AI_IDE_EXTENSIONS[dir].templateDir;
    if (!ideDir) {
      console.log(
        `  ${YELLOW}Warning: No template directory found for ${ideDir}${RESET}`
      );
      return;
    }

    if (fs.existsSync(ideDir)) {
      console.log(`  ${GREEN}Found templates for ${ideDir}${RESET}`);
      foundAny = true;
    } else {
      console.log(
        `  ${YELLOW}Warning: No templates found for ${ideDir}${RESET}`
      );
    }
  });

  if (!foundAny) {
    console.error(
      `${RED}Error: No tool-specific template directories found${RESET}`
    );
    valid = false;
  }

  return valid;
}

/**
 * Downloads and unpacks the specified AI IDE extension
 * -----------------------------------------------------
 * This function downloads the zip file for a given AI IDE extension,
 * extracts it to the appropriate directory, and verifies the config path.
 *
 * @param {string} extension - The AI IDE extension (e.g., ".roo", ".cline")
 * @returns {Promise<void>}
 */
async function downloadAndUnpackAIExtension(extension) {
  const { url } = AI_IDE_EXTENSIONS[extension];

  // Skip processing if the URL is null
  if (!url) {
    console.log(
      `${YELLOW}Info${RESET}: Skipping download and unpack for ${extension} as it has no URL.`
    );
    return;
  }

  const zipPath = path.join(projectRoot, `${extension.substring(1)}.zip`);
  const extractPath = path.join(projectRoot, extension.substring(1));

  console.log(`Downloading and unpacking ${extension} ...`);

  try {
    console.log(`Downloading from ${url} to ${zipPath}`);
    await new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          if (res.statusCode === 302) {
            const redirectUrl = res.headers.location;
            console.log(`Redirecting to ${redirectUrl}`);
            https
              .get(redirectUrl, (redirectRes) => {
                if (redirectRes.statusCode !== 200) {
                  reject(
                    new Error(
                      `Failed to download ${extension}.zip after redirect: HTTP ${redirectRes.statusCode}`
                    )
                  );
                  return;
                }
                const file = fs.createWriteStream(zipPath);
                redirectRes.pipe(file);
                file.on("finish", () => {
                  file.close();
                  console.log(`Downloaded ${extension}.zip successfully`);
                  resolve();
                });
              })
              .on("error", (redirectErr) => {
                fs.unlinkSync(zipPath);
                console.error(
                  `Error downloading ${extension}.zip after redirect:`,
                  redirectErr.message
                );
                reject(redirectErr);
              });
          } else if (res.statusCode !== 200) {
            reject(
              new Error(
                `Failed to download ${extension}.zip: HTTP ${res.statusCode}`
              )
            );
            return;
          } else {
            const file = fs.createWriteStream(zipPath);
            res.pipe(file);
            file.on("finish", () => {
              file.close();
              console.log(`Downloaded ${extension}.zip successfully`);
              resolve();
            });
          }
        })
        .on("error", (err) => {
          fs.unlinkSync(zipPath);
          console.error(`Error downloading ${extension}.zip:`, err.message);
          reject(err);
        });
    });

    console.log(`Extracting ${extension}.zip to ${extractPath}`);
    try {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);
      console.log(`Unpacked ${extension}.zip to ${extension.substring(1)} folder successfully`);
      
      // Delete the zip file if it exists
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
        console.log(`Deleted ${extension}.zip successfully`);
      }
    } catch (extractError) {
      console.error(`Error extracting ${extension}.zip: ${extractError.message}`);
      // Don't rethrow, let the outer catch handle it
    }
  } catch (error) {
    console.error(
      `Error downloading and unpacking ${extension}: ${error.message}`
    );
  }
}

/**
 * Main installation function
 * --------------------------
 * Updated to handle multiple AI IDE extensions dynamically.
 *
 * @param {Object} options - Installation options
 * @param {boolean} options.forceOverwrite - Whether to force overwrite existing files
 * @returns {Promise<boolean>} - Whether installation was successful
 */
async function install(options = { forceOverwrite: false }) {
  console.log(`${BLUE}RooFlow Installer${RESET}`);

  // Print installation context information (useful for debugging)
  console.log(`Installation details:`);
  console.log(`- Script directory: ${__dirname}`);
  console.log(`- Target directory: ${projectRoot}`);
  console.log(`- Running as postinstall: ${isPostinstall ? "Yes" : "No"}`);
  console.log(`- Supported AI tools: ${AI_TOOL_DIRS.join(", ")}\n`);

  // Download and unpack each AI IDE extension
  for (const extension of AI_TOOL_DIRS) {
    await downloadAndUnpackAIExtension(extension);
  }

  // Verify template directories exist
  if (!verifyTemplateDirectories()) {
    console.error(
      `${RED}Installation cannot proceed due to missing template directories${RESET}`
    );
    return false;
  }

  // Get list of files to copy based on supported tools
  const FILES = getFilesToCopy();

  // Copy all files from templates
  console.log("Copying template files ...");
  let copySuccess = true;

  try {
    // Process each file in the copy list
    for (const file of FILES) {
      const success = await copyFile(file.src, file.dest, file.isAbsolutePath, options.forceOverwrite);

      if (!success) {
        console.log(`  ${YELLOW}Warning: Failed to copy ${file.src}${RESET}`);
        if (file.dest.includes("modes")) {
          console.log(
            `  ${YELLOW}Note: Missing modes file for ${path.dirname(
              file.dest
            )}${RESET}`
          );
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
      cleanupDownloadedExtensions();

      if (validationSuccess) {
        // Report successful installation
        console.log(`\n${GREEN}Installation complete!${RESET}`);
        console.log(
          "Your project is now configured to use the following AI tools:"
        );

        AI_TOOL_DIRS.forEach((dir) => {
          console.log(
            `  ${BLUE}${dir}${RESET} - Contains system prompt files for ${dir.substring(
              1
            )}`
          );
        });

        console.log("\nDirectory structure created:");
        AI_TOOL_DIRS.forEach((dir) => {
          console.log(`  ${dir}/ - System prompt files`);
          if (dir === ".roo") {
            console.log("  .roomodes - Mode configurations file for RooFlow");
            console.log("  .rooignore - ignore file for RooFlow");
          }
        });

        console.log(
          "\nThe memory-bank directory will be created automatically when you first use the AI tools."
        );
        console.log("\nTo start using RooFlow (primary tool):");
        console.log("  1. Open your project in VS Code");
        console.log("  2. Ensure the Roo Code extension is installed");
        console.log(
          "  3. Follow the instructions in the ./.roo/README.md file to setup the defaults and the Memory Bank"
        );
        console.log('  4. Start a new Roo Code chat and say "Hello"');
      } else {
        // Installation completed but with warnings
        console.log(`\n${YELLOW}Installation completed with warnings${RESET}`);
        console.log(
          "Some system prompt files may have YAML issues that need manual attention."
        );
        console.log(
          "Your project is configured, but you may encounter issues."
        );
        console.log("\nTo fix YAML issues, you can run the validation again:");
        console.log("  node node_modules/vibecoder/sanitizer.js");
      }

      // Provide recovery options for any issues
      console.log(
        "\nIf you have any issues with automatic installation, you can always (NOTE that the files will be overwritten so be careful!):"
      );
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

/**
 * Parse command line arguments
 * ----------------------------
 * Parses command line arguments to determine installation options.
 *
 * @returns {Object} Options object with parsed command line arguments
 */
function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const options = {
    forceOverwrite: false,
    help: false
  };

  for (const arg of args) {
    if (arg === '--force' || arg === '-f') {
      options.forceOverwrite = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

/**
 * Display help information
 * -----------------------
 * Shows usage information and available command line options.
 */
function showHelp() {
  console.log(`
${BLUE}RooFlow Installer Help${RESET}
Usage: node installer.js [options]

Options:
  -f, --force    Force overwrite of existing files (by default, existing files are preserved)
  -h, --help     Display this help message

Examples:
  node installer.js              # Normal installation (preserves existing files)
  node installer.js --force      # Force overwrite all files
  `);
  process.exit(0);
}

// Add error handler for better diagnostic information
process.on("uncaughtException", (error) => {
  console.error(`${RED}Installer encountered an error:${RESET}`);
  console.error(error);
  console.error("\nIf installation failed, you can run it manually:");
  console.error("- npm run setup");
  console.error("- node node_modules/vibecode/installer.js");
  console.error("- Add --force to overwrite existing files: node node_modules/vibecode/installer.js --force");
  process.exit(1);
});

// Parse command line arguments
const options = parseCommandLineArgs();

// Show help if requested
if (options.help) {
  showHelp();
}

// Run the installation
console.log("Installer running ...");
if (options.forceOverwrite) {
  console.log(`${YELLOW}Force overwrite mode enabled${RESET} - Existing files will be overwritten`);
} else {
  console.log(`${BLUE}Preserve mode enabled${RESET} - Existing files will be kept`);
}

install(options).catch((error) => {
  console.error(`${RED}Installation failed:${RESET}`, error);
  process.exit(1);
});
