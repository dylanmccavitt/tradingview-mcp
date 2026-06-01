import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";

import { runCli } from "../src/cli.js";

function captureStream(chunks: string[]): Writable {
  return new Writable({
    write(
      chunk: Buffer | string,
      _encoding: BufferEncoding,
      callback: (error?: Error | null) => void
    ) {
      chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
      callback();
    }
  });
}

void test("CLI lists universe groups from the sample config", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const exitCode = await runCli(["universe", "list"], {
    stdout: captureStream(stdout),
    stderr: captureStream(stderr)
  });

  assert.equal(exitCode, 0);
  assert.equal(stderr.join(""), "");
  assert.match(stdout.join(""), /semis: Semiconductors/);
  assert.match(stdout.join(""), /enterprise-software: Enterprise Software/);
  assert.match(stdout.join(""), /cybersecurity: Cybersecurity/);
});

void test("CLI resolves a selected universe group and tier", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const exitCode = await runCli(
    ["universe", "resolve", "--group", "semis", "--tier", "core"],
    {
      stdout: captureStream(stdout),
      stderr: captureStream(stderr)
    }
  );

  const output = stdout.join("");

  assert.equal(exitCode, 0);
  assert.equal(stderr.join(""), "");
  assert.match(output, /NASDAQ:NVDA \(NVDA\)/);
  assert.doesNotMatch(output, /NASDAQ:MRVL/);
});

void test("CLI reports invalid universe selection as usage error", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const exitCode = await runCli(
    ["universe", "resolve", "--group", "missing", "--tier", "core"],
    {
      stdout: captureStream(stdout),
      stderr: captureStream(stderr)
    }
  );

  assert.equal(exitCode, 2);
  assert.equal(stdout.join(""), "");
  assert.match(stderr.join(""), /Unknown universe group: missing/);
});
