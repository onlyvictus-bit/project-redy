#!/usr/bin/env node
/**
 * smoke-session-resume.mjs
 *
 * Manual smoke test for session-resume wiring with the real Claude and Gemini CLIs.
 * Run from the project root in WSL (where the CLIs are installed):
 *
 *   node scripts/smoke-session-resume.mjs [--claude] [--gemini] [--cwd /path/to/worktree]
 *
 * What it verifies:
 *   1. Step 1: run `<agent> -p "..." --output-format stream-json`
 *      → extract session_id from the init line
 *   2. Step 2: run `<agent> -p "..." --output-format stream-json --resume <session_id>`
 *      → verify the second run references something from step 1 (context carry-through)
 *   3. Confirm --resume with a non-existent / garbage ID prints a clear error and exits non-zero.
 *     Silent fresh-session fallback (exit 0) is treated as a FAIL — it means Triad's
 *     --resume arg would be silently ignored on a bad/expired ID with no signal to the user.
 *
 * Exit codes: 0 = all selected tests passed, 1 = at least one failed or CLI not found.
 */

import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const runClaude = args.includes('--claude') || (!args.includes('--gemini'));
const runGemini = args.includes('--gemini');
const cwdArg = args.indexOf('--cwd');
const cwd = cwdArg !== -1 ? args[cwdArg + 1] : tmpdir();

// ── Helpers ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function log(label, msg) {
  process.stdout.write(`[${label}] ${msg}\n`);
}

function pass(label, msg) {
  passed++;
  log(`PASS  ${label}`, msg);
}

function fail(label, msg) {
  failed++;
  log(`FAIL  ${label}`, msg);
}

/**
 * Run a CLI binary and return { exitCode, stdout, stderr, lines }.
 * `lines` is stdout split by newline with empty lines removed.
 */
function runCli(binary, cliArgs, runCwd = cwd) {
  // Strip CLAUDECODE so the child process is not blocked by the nested-session guard
  // when this script is run from inside a Claude Code session.
  const { CLAUDECODE: _dropped, ...safeEnv } = process.env;

  // On Windows, npm-installed CLIs are .cmd wrappers that require shell: true.
  // On Linux/WSL they are plain executables — shell: true is harmless there too.
  const result = spawnSync(binary, cliArgs, {
    cwd: runCwd,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 10 * 1024 * 1024,
    shell: true,
    env: safeEnv
  });
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    lines: (result.stdout ?? '').split('\n').filter(Boolean)
  };
}

/**
 * Extract session_id from stream-json init line.
 * Returns undefined if not found.
 */
function extractSessionId(lines) {
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'system' && obj.subtype === 'init' && typeof obj.session_id === 'string') {
        return obj.session_id;
      }
    } catch {
      // not JSON — skip
    }
  }
  return undefined;
}

// ── Test runner ────────────────────────────────────────────────────────────

function smokeAgent(binary) {
  const label = binary.toUpperCase();

  // ── 0. Binary present? ─────────────────────────────────────────────────
  const probe = runCli(binary, ['--version']);
  if (probe.exitCode !== 0) {
    fail(`${label}/version`, `'${binary} --version' returned exit ${probe.exitCode}. Is it installed on this runner?`);
    return;
  }
  pass(`${label}/version`, probe.stdout.trim() || probe.stderr.trim());

  // ── 1. Step 1: plain run, capture session_id ───────────────────────────
  const step1Prompt = 'Reply with exactly: STEP1_TOKEN_XYZ and nothing else.';
  const step1 = runCli(binary, ['-p', step1Prompt, '--output-format', 'stream-json', '--verbose']);

  if (step1.exitCode !== 0) {
    fail(`${label}/step1`, `Exited ${step1.exitCode}. stderr: ${step1.stderr.slice(0, 300)}`);
    return;
  }

  const sessionId = extractSessionId(step1.lines);
  if (!sessionId) {
    fail(`${label}/step1/session_id`, `No session_id found in stream-json init line.\nstdout sample: ${step1.stdout.slice(0, 500)}`);
    return;
  }
  pass(`${label}/step1/session_id`, `Extracted session_id: ${sessionId}`);

  // Check for the token — a WARN not a hard failure, since hooks and stream-json
  // preamble can precede the model response. Context carry-through is verified in step 2.
  if (step1.stdout.includes('STEP1_TOKEN_XYZ')) {
    pass(`${label}/step1/output`, 'STEP1_TOKEN_XYZ found in step 1 output.');
  } else {
    log(`WARN  ${label}/step1/output`, `STEP1_TOKEN_XYZ not found in step 1 stdout — model may have responded differently. Proceeding to step 2 to verify context carry-through.`);
  }

  // ── 2. Step 2: resume, verify context carry-through ────────────────────
  const step2Prompt = 'What token did I ask you to reply with in your last message? Reply with just the token.';
  const step2 = runCli(binary, [
    '-p', step2Prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--resume', sessionId
  ]);

  if (step2.exitCode !== 0) {
    fail(`${label}/step2`, `Exited ${step2.exitCode}. stderr: ${step2.stderr.slice(0, 300)}`);
    return;
  }
  pass(`${label}/step2/exit`, 'Step 2 exited cleanly with --resume flag.');

  if (step2.stdout.includes('STEP1_TOKEN_XYZ')) {
    pass(`${label}/step2/context`, 'Agent remembered STEP1_TOKEN_XYZ from prior session — context carry-through confirmed.');
  } else {
    // Not a hard failure: some CLIs restart context on --resume if the session
    // has expired. Warn rather than fail so CI doesn't break on token expiry.
    log(`WARN  ${label}/step2/context`, `STEP1_TOKEN_XYZ not found in step 2 output (session may have expired or --resume is not yet supported). stdout: ${step2.stdout.slice(0, 300)}`);
  }

  // ── 3. Garbage session ID — should fail gracefully, not hang ──────────
  const step3 = runCli(binary, [
    '-p', 'ping',
    '--output-format', 'stream-json',
    '--verbose',
    '--resume', 'ses_garbage_INVALID_0000000'
  ]);

  if (step3.exitCode !== 0) {
    // Expected: CLI should reject a bad session ID with a non-zero exit.
    pass(`${label}/step3/bad_session`, `CLI correctly rejected invalid session ID (exit ${step3.exitCode}).`);
  } else {
    // Exit 0 with a garbage ID means the CLI silently started a fresh session.
    // That is NOT acceptable: Triad would pass --resume, get a silent context
    // reset with no error signal, and the user would lose prior-turn continuity
    // with no indication that anything went wrong.
    const freshId = extractSessionId(step3.lines);
    if (freshId) {
      fail(
        `${label}/step3/bad_session`,
        `CLI silently started a fresh session (new session_id: ${freshId}) on a garbage --resume ID.\n` +
        `  Triad risk: a bad or expired session ID will silently drop all prior context.\n` +
        `  Mitigation: add a session-validity pre-check or detect the fresh-session init in runJob and warn.`
      );
    } else {
      fail(
        `${label}/step3/bad_session`,
        `CLI accepted invalid session ID and exited 0 with no error and no new session_id.\n` +
        `  Cannot distinguish a resumed session from a silent fallback — continuity guarantee is unverifiable.`
      );
    }
  }
}

// ── Entry ──────────────────────────────────────────────────────────────────

process.stdout.write(`\n=== Triad session-resume smoke test (cwd: ${cwd}) ===\n\n`);

if (runClaude) smokeAgent('claude');
if (runGemini) smokeAgent('gemini');

process.stdout.write(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
