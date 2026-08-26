// End-to-end test for the emergency vs normal PPO approval flow.
// Requires Node 18+ (built-in fetch). Run against your REAL running backend:
//
//   node test-emergency-flow.mjs
//
// Fill in real usernames/passwords for existing accounts below first.
// Uses accounts you already created with create-account.ts.

const API_BASE = "http://localhost:4000";

const DEPT = { username: "academic.affairs", password: "CHANGE_ME" };
const PPO = { username: "ppo.head", password: "CHANGE_ME" };

let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ PASS — ${label}`);
    pass++;
  } else {
    console.log(`  ❌ FAIL — ${label} ${detail}`);
    fail++;
  }
}

async function login(username, password, portal) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, portal }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${username}: ${data.error}`);
  return data.token;
}

async function authedFetch(token, path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function submitJobOrder(deptToken, isEmergency) {
  const description = isEmergency
    ? "TEST: exposed live wiring sparking near Chemistry Lab entrance — immediate danger"
    : "TEST: routine flickering light bulb in Room 204, no urgency";
  const { ok, data } = await authedFetch(deptToken, "/api/job-orders", {
    method: "POST",
    body: JSON.stringify({
      office: "Academic Affairs Office",
      description,
      requestedByName: "Test Script Runner",
      isEmergency,
    }),
  });
  if (!ok) throw new Error(`Job order submission failed: ${JSON.stringify(data)}`);
  return data; // includes id, isEmergency, status, ppoApproved, etc.
}

async function runEmergencyTest(deptToken, ppoToken) {
  console.log("\n=== TEST 1: Emergency track ===");
  const ticket = await submitJobOrder(deptToken, true);
  console.log(`  Submitted ${ticket.id} (isEmergency=${ticket.isEmergency})`);
  check("Ticket created with isEmergency=true", ticket.isEmergency === true);

  const { ok, data: approved } = await authedFetch(ppoToken, "/api/job-orders/ppo-approve", {
    method: "POST",
    body: JSON.stringify({ id: ticket.id, estimatedCost: 4500 }),
  });
  check("PPO approval request succeeded", ok, JSON.stringify(approved));
  check("Status jumped straight to In Progress", approved.status === "In Progress", `(got ${approved.status})`);
  check("ppoApproved is true", approved.ppoApproved === true);
  check("schoolHeadApproved is true (auto, exempted)", approved.schoolHeadApproved === true);
  check("financeApproved is true (auto, exempted)", approved.financeApproved === true);

  const { data: logsData } = await authedFetch(ppoToken, "/api/logs");
  const staffNotif = (logsData.notifications || []).find(
    (n) => n.role === "Staff" && n.message.includes(ticket.id)
  );
  check("Staff was notified immediately", !!staffNotif, "(no matching Staff notification found)");

  return ticket.id;
}

async function runNormalTest(deptToken, ppoToken) {
  console.log("\n=== TEST 2: Normal track (unchanged behavior) ===");
  const ticket = await submitJobOrder(deptToken, false);
  console.log(`  Submitted ${ticket.id} (isEmergency=${ticket.isEmergency})`);
  check("Ticket created with isEmergency=false/undefined", !ticket.isEmergency);

  const { ok, data: approved } = await authedFetch(ppoToken, "/api/job-orders/ppo-approve", {
    method: "POST",
    body: JSON.stringify({ id: ticket.id, estimatedCost: 1200 }),
  });
  check("PPO approval request succeeded", ok, JSON.stringify(approved));
  check("Status stays Pending (not auto In Progress)", approved.status === "Pending", `(got ${approved.status})`);
  check("ppoApproved is true", approved.ppoApproved === true);
  check("schoolHeadApproved is still false", approved.schoolHeadApproved === false);
  check("financeApproved is still false", approved.financeApproved === false);

  const { data: logsData } = await authedFetch(ppoToken, "/api/logs");
  const schoolHeadNotif = (logsData.notifications || []).find(
    (n) => n.role === "SchoolHead" && n.message.includes(ticket.id)
  );
  const staffNotif = (logsData.notifications || []).find(
    (n) => n.role === "Staff" && n.message.includes(ticket.id)
  );
  check("School Head was notified (normal routing)", !!schoolHeadNotif);
  check("Staff was NOT notified yet (correctly withheld)", !staffNotif);

  return ticket.id;
}

(async () => {
  try {
    console.log("Logging in...");
    const deptToken = await login(DEPT.username, DEPT.password, "Dept");
    const ppoToken = await login(PPO.username, PPO.password, "Admin");
    console.log("  Logged in as Dept and PPO successfully.");

    await runEmergencyTest(deptToken, ppoToken);
    await runNormalTest(deptToken, ppoToken);

    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
    process.exit(fail > 0 ? 1 : 0);
  } catch (err) {
    console.error("\n💥 Script error (backend unreachable, bad credentials, or unexpected response):");
    console.error(err.message);
    process.exit(1);
  }
})();
