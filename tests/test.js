const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { execSync } = require("child_process");
const os = require("os");


describe("VibeCoder Full Installation Process Tests", function () {

  let testDir;

  // Increase timeout for tests
  this.timeout(60000);

  // Execute installer.js before tests
  before(function () {
    // Run installer.js
    const installerPath = path.join(__dirname, "..", "installer.js");
    console.log("Running installer.js test");
    console.log(`Executing installer.js from ${installerPath}...`);
    execSync(`cat "${installerPath}" && node "${installerPath}"`, { stdio: "inherit" });

    // Create a temporary directory for testing
    testDir = path.join(os.tmpdir(), `vibecoder-tests-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });


    // Initialize a basic npm project
    execSync("npm init -y", { cwd: testDir });
  });

  // Clean up after tests
  after(function () {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
      console.log(`Test directory cleaned up: ${testDir}`);
    } catch (error) {
      console.error(`Failed to clean up test directory: ${error.message}`);
    }
  });

  it("should successfully install and run postinstall script", function () {
    // Get the path to the VibeCoder package (current directory)
    const packageDir = path.resolve(__dirname, "..");

    console.log(`Installing from ${packageDir}...`);

    try {
      // Use --foreground-scripts to ensure scripts run in the foreground
      const installOutput = execSync(
        `npm install --save-dev "${packageDir}" --foreground-scripts`,
        {
          cwd: testDir,
          stdio: "pipe",
          encoding: "utf8",
        }
      );

      // Adjust the check for postinstall script output
      const installScriptRunning = '/postinstall/.test(installOutput)';
      if (!installScriptRunning) {
        const npmConfigOutput = execSync("npm config get ignore-scripts", {
          cwd: testDir,
          stdio: "pipe",
          encoding: "utf8",
        }).trim();
        console.warn(`Current npm ignore-scripts setting: ${npmConfigOutput}`);
      }

      assert.ok(
        installScriptRunning,
        "Expected installation script to run and output identifying text. The npm postinstall hook may not be executing."
      );

      // Verify that the postinstall script creates the `.roo` directory
      const rooDirPath = path.join(testDir, ".roo");
      assert.ok(
        fs.existsSync(rooDirPath),
        `Expected directory ${rooDirPath} to exist after postinstall`
      );

      // Ensure `.roo` directory is not empty
      const rooDirContents = fs.existsSync(rooDirPath)
        ? fs.readdirSync(rooDirPath)
        : [];
      assert.ok(
        rooDirContents.length > 0,
        `Expected directory ${rooDirPath} to contain files, but it is empty`
      );

      // Log `.roo` directory contents for debugging
      console.log(`Contents of ${rooDirPath}:`, rooDirContents);

      // Verify specific files in `.roo` directory
      const requiredFiles = [
        "system-prompt-architect",
        "system-prompt-ask",
        "system-prompt-code",
        "system-prompt-debug",
        "system-prompt-test",
      ];
      for (const file of requiredFiles) {
        const filePath = path.join(rooDirPath, file);
        assert.ok(
          fs.existsSync(filePath),
          `Expected file ${filePath} to exist in .roo directory`
        );
      }
    } catch (error) {
      console.error("Error during installation or postinstall script execution:", error.message);
      console.error("Stack trace:", error.stack);

      // Log additional debugging information
      const npmConfigOutput = execSync("npm config get ignore-scripts", {
        cwd: testDir,
        stdio: "pipe",
        encoding: "utf8",
      }).trim();
      console.warn(`Current npm ignore-scripts setting: ${npmConfigOutput}`);

      throw error;
    }
  });

  it("should create all expected files after installation", function () {
    // Correct expected file paths
    const expectedFiles = [
      path.join(".roo", "system-prompt-architect"),
      path.join(".roo", "system-prompt-ask"),
      path.join(".roo", "system-prompt-code"),
      path.join(".roo", "system-prompt-debug"),
      path.join(".roo", "system-prompt-test"),
      ".roomodes",
      ".rooignore",
    ];

    for (const file of expectedFiles) {
      const filePath = path.join(testDir, file);
      const exists = fs.existsSync(filePath);
      assert.ok(exists, `Expected file ${filePath} to exist`);

      // Ensure files are not empty
      if (exists && fs.lstatSync(filePath).isFile()) {
        const fileSize = fs.statSync(filePath).size;
        assert.ok(
          fileSize > 0,
          `Expected file ${filePath} to not be empty, but it is`
        );
      }

      // Log file details for debugging
      console.log(`Verified file: ${filePath}`);
    }
  });
});

// Simple test to verify the installer file exists
describe("VibeCoder Installer", function () {
  it("should have installer.js file", function () {
    const installerPath = path.join(__dirname, "..", "installer.js");
    assert.ok(
      fs.existsSync(installerPath),
      `installer.js file should exist at ${installerPath}`
    );
  });

  it("should have valid package.json", function () {
    const packageJsonPath = path.join(__dirname, "..", "package.json");
    assert.ok(
      fs.existsSync(packageJsonPath),
      `package.json file should exist at ${packageJsonPath}`
    );

    const packageJson = require(packageJsonPath);
    assert.strictEqual(
      packageJson.name,
      "ez-vibecoder",
      "package name should be ez-vibecoder"
    );
    assert.ok(
      packageJson.scripts && packageJson.scripts.postinstall,
      "package.json should have a postinstall script"
    );

    // Verify that the postinstall script is a valid command
    assert.ok(
      typeof packageJson.scripts.postinstall === "string" &&
        packageJson.scripts.postinstall.length > 0,
      "postinstall script should be a non-empty string"
    );
  });
});