#!/usr/bin/env node

/**
 * scripts/generate-plan.js
 *
 * Generate a harness-compatible plan.yaml from a Markdown prompt file and
 * ensure a minimal workspace/rules.yaml exists.
 *
 * Usage:
 *   generate-plan.js <prompt-file> <output-plan.yaml> [output-rules.yaml]
 *
 * The prompt markdown is embedded as the goal.description. The generated
 * plan.yaml is valid YAML and conforms to the harness plan schema:
 *   meta, goal, inputs, outputs, completion_criteria, rules.
 *
 * If output-rules.yaml is provided and the file does not already exist, a
 * minimal rules.yaml is written so the harness does not fail on a missing
 * rules file.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Minimal default rules used when no rules file exists.
 *
 * @returns {object} Rules object with an array of rule definitions.
 */
function defaultRules() {
  return {
    rules: [
      {
        id: 'RULE-001',
        name: 'Keep tests in sample language',
        description:
          'New FVT tests must use the same language and framework as the sample project.',
        required: true,
        check: 'language matches',
      },
      {
        id: 'RULE-002',
        name: 'Do not modify application source',
        description: 'Prefer adding tests over changing application code.',
        required: true,
        check: 'source diff empty',
      },
    ],
  };
}

/**
 * Build harness rule references from a rules object.
 *
 * Every rule defined in the rules object is referenced in the plan with
 * `applies: true`. This ensures the generated plan passes validation against
 * the generated rules.
 *
 * @param {object} rules - Parsed rules object (from rules.yaml).
 * @returns {object[]} Array of plan rule references.
 */
function buildRuleRefs(rules) {
  const ruleList = Array.isArray(rules.rules) ? rules.rules : [];
  return ruleList.map((rule) => ({
    rule_id: rule.id,
    applies: true,
  }));
}

/**
 * Extract YAML blocks from a Markdown prompt and merge them into a phased plan.
 *
 * Looks for fenced `yaml` code blocks that start with `meta:`, `inputs:`,
 * `phases:`, or `rules:`. If found, they are concatenated and parsed into a
 * single phased plan object. If no phased blocks are found, falls back to
 * `undefined` so the caller can build a legacy plan.
 *
 * @param {string} prompt - Markdown content of the prompt.
 * @param {object} rules - Parsed rules object used to populate plan rule refs.
 * @returns {object|undefined} Parsed phased plan, or undefined if none found.
 */
function extractPhasedPlan(prompt, rules) {
  const blocks = [];
  const regex = /^```yaml\n([\s\S]*?)\n```$/gm;
  let match;
  while ((match = regex.exec(prompt)) !== null) {
    const block = match[1];
    if (
      block.startsWith('meta:') ||
      block.startsWith('inputs:') ||
      block.startsWith('phases:') ||
      block.startsWith('rules:')
    ) {
      blocks.push(block);
    }
  }
  if (blocks.length === 0) {
    return undefined;
  }

  // Normalize phase sub-blocks: the prompt contains multiple `phases:` fenced
  // blocks (setup outputs, execute outputs, teardown outputs). Merge them
  // under a single `phases:` root so the combined YAML is valid.
  const phaseSubBlocks = [];
  const otherBlocks = [];
  for (const block of blocks) {
    if (block.startsWith('phases:')) {
      const body = block.replace(/^phases:\n?/, '');
      if (
        /^\s+setup:\s*$/m.test(body) ||
        /^\s+execute:\s*$/m.test(body) ||
        /^\s+teardown:\s*$/m.test(body)
      ) {
        phaseSubBlocks.push(body);
      } else {
        otherBlocks.push(block);
      }
    } else if (block.startsWith('meta:')) {
      // Prefer the first meta block (the one with the title and version).
      const existingMeta = otherBlocks.find((b) => b.startsWith('meta:'));
      if (!existingMeta) {
        otherBlocks.push(block);
      }
    } else {
      otherBlocks.push(block);
    }
  }

  let combined;
  if (phaseSubBlocks.length > 0) {
    const mergedPhases = 'phases:\n' + phaseSubBlocks.map((b) => b.replace(/^/gm, '  ')).join('\n');
    combined = [...otherBlocks, mergedPhases].join('\n');
  } else {
    combined = otherBlocks.join('\n');
  }

  const parsed = yaml.load(combined);
  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }
  // Ensure required sections are present; otherwise fall back.
  if (!parsed.meta || !parsed.phases) {
    return undefined;
  }
  // Apply rule references from the generated/loaded rules file.
  parsed.rules = buildRuleRefs(rules);
  return parsed;
}

/**
 * Build a legacy (version "1") harness Plan object from a Markdown prompt.
 *
 * @param {string} promptPath - Absolute path to the source prompt file.
 * @param {string} prompt - Markdown content of the prompt.
 * @param {object} rules - Parsed rules object used to populate plan rule refs.
 * @returns {object} Plan object matching the legacy harness schema.
 */
function buildLegacyPlan(promptPath, prompt, rules) {
  return {
    meta: {
      title: 'FVT Coverage Run',
      version: '1',
      author: 'agentic-harness',
    },
    goal: {
      description: prompt,
      measurable:
        "The target repo's test suite has more passing tests and higher coverage than at the start of the run.",
    },
    inputs: [
      {
        name: 'prompt',
        type: 'file',
        path: path.relative(path.dirname(promptPath), promptPath),
        description: 'Original Markdown prompt used to derive this plan',
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'file',
        path: 'result.yaml',
        description: 'Final harness result with status and iterations',
      },
    ],
    completion_criteria: [
      {
        id: 'CC-001',
        description: 'FVT tests were generated or updated',
        test: 'npm test passes with at least as many tests as before',
      },
    ],
    rules: buildRuleRefs(rules),
  };
}

/**
 * Build a harness Plan object from a Markdown prompt.
 *
 * If the prompt contains extractable phased plan YAML blocks, they are used
 * directly to produce a version "2" plan. Otherwise a legacy plan is built
 * with the prompt embedded as goal.description.
 *
 * @param {string} promptPath - Absolute path to the source prompt file.
 * @param {string} prompt - Markdown content of the prompt.
 * @param {object} rules - Parsed rules object used to populate plan rule refs.
 * @returns {object} Plan object matching the harness schema.
 */
function buildPlan(promptPath, prompt, rules) {
  const phasedPlan = extractPhasedPlan(prompt, rules);
  if (phasedPlan) {
    return phasedPlan;
  }
  return buildLegacyPlan(promptPath, prompt, rules);
}

/**
 * Write a minimal default rules.yaml to the target workspace.
 *
 * The rules file is always written to the target workspace when missing,
 * even if a rules.yaml exists elsewhere. Existing rules files are left
 * untouched.
 *
 * @param {string} rulesFile - Absolute path to the rules output file.
 * @returns {object} The rules object that was (or already is) at rulesFile.
 */
async function writeDefaultRules(rulesFile) {
  let rules;
  try {
    await fs.access(rulesFile);
    console.log(`[generate-plan] Rules already exist: ${rulesFile}`);
    rules = yaml.load(await fs.readFile(rulesFile, 'utf-8'));
    return rules;
  } catch {
    // File does not exist; continue and create it.
  }

  rules = defaultRules();

  await fs.mkdir(path.dirname(rulesFile), { recursive: true });
  await fs.writeFile(rulesFile, yaml.dump(rules, { lineWidth: -1, noRefs: true }), 'utf-8');
  console.log(`[generate-plan] Wrote default rules to ${rulesFile}`);
  return rules;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.length > 3) {
    console.error(
      'Usage: generate-plan.js <prompt-file> <output-plan.yaml> [output-rules.yaml]',
    );
    process.exit(1);
  }

  const [promptFile, outputFile, rulesFile] = args;

  const prompt = await fs.readFile(promptFile, 'utf-8');

  let rules;
  if (rulesFile) {
    rules = await writeDefaultRules(path.resolve(rulesFile));
  } else {
    rules = defaultRules();
  }

  const plan = buildPlan(path.resolve(promptFile), prompt, rules);
  const planYaml = yaml.dump(plan, { lineWidth: -1, noRefs: true });

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, planYaml, 'utf-8');

  console.log(`[generate-plan] Wrote plan to ${outputFile}`);
}

main().catch((err) => {
  console.error(`[generate-plan] ERROR: ${err.message}`);
  process.exit(1);
});
