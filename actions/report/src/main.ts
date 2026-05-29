import * as fs from "fs";
import * as path from "path";
import * as core from "@actions/core";
import axios from "axios";

const API_ENDPOINT = "https://longears-api-<hash>-ew.a.run.app/ingest";

async function run(): Promise<void> {
  const reportFile = core.getInput("report-file") || "longears-results.json";
  const apiKey     = core.getInput("api-key", { required: true });

  const absoluteReportFile = path.isAbsolute(reportFile)
    ? reportFile
    : path.join(process.cwd(), reportFile);

  core.info(`Longears Report: reading scan results from ${absoluteReportFile}`);

  let reportPayload: unknown;
  try {
    const raw = fs.readFileSync(absoluteReportFile, "utf8");
    reportPayload = JSON.parse(raw);
  } catch (err) {
    core.setFailed(`Failed to read report file: ${String(err)}`);
    return;
  }

  core.info(`Longears Report: POSTing to ${API_ENDPOINT}`);

  let statusCode: number;
  let responseBody: string;

  try {
    const response = await axios.post(API_ENDPOINT, reportPayload, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      timeout: 10_000,
      validateStatus: () => true,
    });

    statusCode   = response.status;
    responseBody = typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data);
  } catch (err) {
    core.setFailed(`HTTP request failed: ${String(err)}`);
    return;
  }

  core.setOutput("status-code",   String(statusCode));
  core.setOutput("response-body", responseBody);
  core.info(`Longears Report: received HTTP ${statusCode}`);
  core.debug(`Response body: ${responseBody}`);

  if (statusCode < 200 || statusCode >= 300) {
    core.setFailed(`API returned non-2xx status: ${statusCode}`);
    return;
  }

  core.info("Longears Report: successfully delivered.");
}

run().catch((err: unknown) => {
  core.setFailed(`Longears Report failed: ${String(err)}`);
});
