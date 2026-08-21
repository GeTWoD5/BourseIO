import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Render a local French voice-over on every supported host.
 *
 * Windows keeps the existing System.Speech implementation. Linux prefers
 * Piper when a model is configured and falls back to espeak-ng, which keeps
 * the studio usable without sending text to a third-party service.
 */
export async function renderVoiceover({ root, textPath, outputPath }) {
  if (process.platform === "win32") {
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", `${root}/scripts/render-voiceover.ps1`,
      "-TextPath", textPath,
      "-OutputPath", outputPath
    ], { windowsHide: true });
    return { rendered: existsSync(outputPath), engine: "windows-speech" };
  }

  const text = (await readFile(textPath, "utf8")).trim();
  if (!text) return { rendered: false, engine: "empty" };

  const piperVoice = process.env.PIPER_VOICE_PATH;
  if (piperVoice) {
    if (!existsSync(piperVoice)) {
      throw new Error(`PIPER_VOICE_PATH introuvable : ${piperVoice}`);
    }
    await runWithInput(
      process.env.PIPER_PATH ?? "piper",
      ["--model", piperVoice, "--output_file", outputPath],
      text
    );
    return { rendered: existsSync(outputPath), engine: "piper" };
  }

  await execFileAsync("espeak-ng", ["-v", "fr-fr", "-s", "145", "-w", outputPath, text]);
  return { rendered: existsSync(outputPath), engine: "espeak-ng" };
}

function runWithInput(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} a quitté avec le code ${code}${stderr ? ` : ${stderr.trim()}` : ""}`));
    });
    child.stdin.end(input);
  });
}
