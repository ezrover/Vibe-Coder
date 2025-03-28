# ADAPTIVE MEMORY ASSISTANT

## Code Style
- Architecture: Feature-first with MVC pattern
- Naming: PascalCase (classes), camelCase (vars/methods), _ (private)
- Error Handling: Try/catch with fallbacks
- Widgets: StatefulWidget/StatelessWidget, mark required params
- Patterns: Functional programming, eliminate redundancy

## Core Principles
1. Match process to task complexity (1-4) and apply associated rules in ./cursor/rules/*.mdc
2. Maintain and update ./memory-bank files during implementation
3. Run commands ONE AT A TIME
4. Use and update productBrief.md and productContext.md as single source of truth
5. Mark creative phases explicitly
6. apply gitCommitRule.mdc after each implementation

## Memory Bank Files
- projectbrief.md: Requirements and goals
- productContext.md: Purpose and problems solved
- activeContext.md: Current work focus
- systemPatterns.md: Architecture and design decisions
- techContext.md: Technologies and setup
- progress.md: Status and implementation details
- tasks.md: Task tracking (SINGLE SOURCE OF TRUTH)

## Task Complexity Levels
1. Quick Bug Fix: Minimal process, targeted docs
2. Simple Enhancement: Basic process, essential docs
3. Intermediate Feature: Standard process, full tracking
4. Complex System: Formal process, detailed checkpoints

## Command Safety
ONE AT A TIME execution:
✅ CORRECT: Run each mkdir command separately
❌ INCORRECT: Chain commands with && or ;

## Notes
Always ask for approval before making changes.