import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");

function readSqlFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({
      file,
      sql: fs.readFileSync(path.join(migrationsDir, file), "utf8")
    }));
}

function unique(values) {
  return [...new Set(values)].sort();
}

function findTables(files) {
  const tables = [];
  const pattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z0-9_]+)/gi;

  for (const { file, sql } of files) {
    for (const match of sql.matchAll(pattern)) {
      tables.push({ table: match[1], file });
    }
  }

  return tables;
}

function includesForTable(sql, table, patternFactory) {
  return patternFactory(table).test(sql);
}

const files = readSqlFiles();
const combinedSql = files.map((file) => file.sql).join("\n\n");
const tableRecords = findTables(files);
const tables = unique(tableRecords.map((record) => record.table));

const report = tables.map((table) => {
  const createdIn = tableRecords.find((record) => record.table === table)?.file || "";
  const rlsEnabled = includesForTable(
    combinedSql,
    table,
    (name) => new RegExp(`alter\\s+table\\s+public\\.${name}\\s+enable\\s+row\\s+level\\s+security`, "i")
  );
  const hasPolicy = includesForTable(
    combinedSql,
    table,
    (name) => new RegExp(`create\\s+policy\\s+[\\s\\S]+?\\s+on\\s+public\\.${name}\\b`, "i")
  );
  const hasAuthenticatedGrant = includesForTable(
    combinedSql,
    table,
    (name) => new RegExp(`grant\\s+[^;]+\\s+on\\s+public\\.${name}\\s+to\\s+authenticated`, "i")
  );
  const hasAnonGrant = includesForTable(
    combinedSql,
    table,
    (name) => new RegExp(`grant\\s+[^;]+\\s+on\\s+public\\.${name}\\s+to\\s+anon`, "i")
  );

  return {
    table,
    createdIn,
    rlsEnabled,
    hasPolicy,
    hasAuthenticatedGrant,
    hasAnonGrant
  };
});

const findings = [];

for (const item of report) {
  if (!item.rlsEnabled) {
    findings.push({
      severity: "high",
      table: item.table,
      issue: "RLS is not enabled in migrations."
    });
  }

  if (!item.hasPolicy) {
    findings.push({
      severity: "high",
      table: item.table,
      issue: "No RLS policy exists in migrations."
    });
  }

  if (item.hasAnonGrant) {
    findings.push({
      severity: "critical",
      table: item.table,
      issue: "Explicit anon grant found. Confirm this table is truly public."
    });
  }
}

console.log(JSON.stringify({ tables: report, findings }, null, 2));

if (findings.some((finding) => finding.severity === "critical" || finding.severity === "high")) {
  process.exitCode = 1;
}
