# VibeCoder Development Guide

## Build/Test Commands
- Run all tests: `npm test` 
- Run a single test: `npx mocha tests/test.js --grep "test description"`
- Manual installation: `node installer.js`
- Force overwrite installation: `node installer.js --force`
- YAML validation: `node sanitizer.js`

## Code Style Guidelines
- **Imports**: Group imports by type (node core, npm packages, local modules)
- **Formatting**: Use 2-space indentation, semicolons required
- **Variables**: Use `const` by default, `let` when necessary, never `var`
- **Naming**: camelCase for variables/functions, PascalCase for classes, UPPER_SNAKE for constants
- **Error Handling**: Use try/catch blocks with specific error messages and console.error for logging
- **Path Handling**: Always use path.join() for cross-platform compatibility
- **Security**: Validate file paths to prevent path traversal, create backups before file modifications
- **Documentation**: JSDoc-style comments for functions describing purpose, parameters, and returns
- **Logging**: Use color-coded console output (RED for errors, YELLOW for warnings, etc.)
- **File Operations**: Check for existence before reading, create required directories before writing

## Memory Bank
This file will be available to agentic coding tools working on VibeCoder to maintain consistency across interactions.