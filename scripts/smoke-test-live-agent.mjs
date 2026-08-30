import { SignJWT } from "jose";

async function main() {
  const secret = "RoLw5fpZO-N4TBtm-WirNonWWftIrY4fW6pjN8MAF30T1e6bBZWBTh3rP-nvArSY";
  const secretBytes = new TextEncoder().encode(secret);
  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Session token
  const sessionToken = await new SignJWT({ scope: "monitor:read" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("project-monitor")
    .setAudience("project-monitor-web")
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + 8 * 3600)
    .sign(secretBytes);

  // 2. Execute lock token
  const execToken = await new SignJWT({ scope: "monitor:execute" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("project-monitor")
    .setAudience("project-monitor-test-runner")
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + 1800)
    .sign(secretBytes);

  const headers = {
    Cookie: `project_monitor_session=${sessionToken}; project_monitor_execute=${execToken}`,
    Origin: "http://localhost:3000",
    "Content-Type": "application/json",
  };

  console.log("[Smoke Test] 1. Fetching catalog...");
  const catRes = await fetch("http://localhost:3000/api/playwright-runner/catalog", { headers });
  const catData = await catRes.json();
  console.log("[Smoke Test] Catalog Presence:", catData.presence);

  const stsProject = catData.catalog?.projects?.find(p => p.id === "sts-playwright");
  const allTests = stsProject?.testGroups?.flatMap(g => g.tests) || [];
  console.log(`[Smoke Test] Discovered ${allTests.length} tests in sts-playwright`);

  // 2. Enqueue Playwright test job for ProjectSTS
  console.log("[Smoke Test] 2. Enqueuing or attaching to test job...");
  const enqueuePayload = {
    projectId: "sts-playwright",
    source: "project-test",
    testIds: [allTests[0]?.id || "e2e-auth-login-spec-ts-login-page-shows-the-auth-e97a4c9d"],
    browsers: ["chromium"],
    mode: "headless",
  };

  const jobRes = await fetch("http://localhost:3000/api/playwright-runner/jobs", {
    method: "POST",
    headers,
    body: JSON.stringify(enqueuePayload),
  });

  const jobData = await jobRes.json();
  let jobId = jobData.job?.id || jobData.id || jobData.activeJobId;
  console.log("[Smoke Test] Target Job ID:", jobId);

  if (!jobId) {
    console.error("[Smoke Test] Could not determine job ID:", jobData);
    process.exit(1);
  }

  // 3. Poll job status and stream terminal logs
  console.log(`[Smoke Test] 3. Polling job ${jobId} and streaming realtime terminal lines...`);
  let afterSeq = 0;
  let totalLines = 0;
  let isDone = false;

  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const pollRes = await fetch(`http://localhost:3000/api/playwright-runner/jobs/${jobId}?afterSequence=${afterSeq}`, { headers });
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();
    
    if (pollData.logs && pollData.logs.length > 0) {
      for (const log of pollData.logs) {
        console.log(`  [TERMINAL seq=${log.sequence} stream=${log.stream}] ${log.message}`);
        totalLines++;
      }
      afterSeq = pollData.nextSequence;
    }

    const st = pollData.job?.status;
    console.log(`  [Status t=${i+1}s] status=${st} logCount=${pollData.job?.logCount ?? totalLines}`);

    if (st === "passed" || st === "failed" || st === "timed_out" || st === "cancelled") {
      isDone = true;
      console.log(`\n======================================================`);
      console.log(`[Smoke Test PASS] Real ProjectSTS Job Completed!`);
      console.log(`  Job ID: ${jobId}`);
      console.log(`  Final Status: ${st}`);
      console.log(`  Total Terminal Lines Delivered: ${totalLines}`);
      console.log(`  Persisted Redis logCount: ${pollData.job?.logCount}`);
      console.log(`======================================================\n`);
      break;
    }
  }

  if (!isDone) {
    console.error("[Smoke Test] Job did not complete within timeout");
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
