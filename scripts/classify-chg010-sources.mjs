import { readFileSync, writeFileSync } from "node:fs";

const unitsPath = ".feature-delivery/active/code-sandbox-generation/source/units.jsonl";
const coveragePath = ".feature-delivery/active/code-sandbox-generation/source/coverage.yaml";
const units = readFileSync(unitsPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));

// Only direct requirement-bearing units live here. Questions, implementation
// authorization, analyst proposals and historical rules superseded by CHG-010
// are deliberately not used as semantic proof.
const requirementMap = {
  "S001-U0003": ["FR-001"],
  "S001-U0004": ["FR-001"],
  "S001-U0005": ["FR-002"],
  "S001-U0006": ["FR-003"],
  "S001-U0007": ["FR-004"],
  "S001-U0008": ["FR-005"],
  "S001-U0009": ["NFR-001"],
  "S001-U0011": ["NFR-002", "NFR-004", "NFR-006"],
  "S001-U0012": ["NFR-002", "NFR-004"],
  "S001-U0013": ["FR-001", "FR-006", "FR-009", "NFR-002"],
  "S001-U0014": ["FR-005", "NFR-002"],
  "S001-U0015": ["NFR-001", "NFR-002"],

  "S002-U0004": ["FR-006"],
  "S002-U0012": ["FR-002", "FR-006"],
  "S002-U0013": ["FR-002", "FR-003", "FR-007"],
  "S002-U0014": ["NFR-003"],
  "S002-U0015": ["FR-004", "FR-008"],

  "S009-U0006": ["FR-003", "NFR-003"],
  "S009-U0007": ["FR-003", "NFR-003"],
  "S009-U0008": ["FR-003", "FR-007", "NFR-003"],
  "S009-U0009": ["FR-003", "NFR-003"],
  "S009-U0010": ["FR-003", "NFR-003"],
  "S009-U0011": ["NFR-003"],
  "S009-U0012": ["NFR-003"],
  "S009-U0015": ["FR-003", "FR-007", "NFR-003"],
  "S009-U0016": ["FR-003", "FR-007", "NFR-003"],
  "S009-U0020": ["FR-004", "NFR-003", "NFR-005"],
  "S009-U0021": ["FR-004", "NFR-003", "NFR-005"],
  "S009-U0022": ["FR-004", "NFR-003", "NFR-005"],
  "S009-U0023": ["FR-004", "NFR-003", "NFR-005"],
  "S009-U0024": ["FR-004", "NFR-003", "NFR-005"],
  "S009-U0027": ["NFR-006"],

  "S012-U0009": ["FR-005", "NFR-005"],
  "S012-U0010": ["FR-005"],

};

const explicitOut = new Map([
  ["S002-U0006", "能力边界追问，不单独扩写为实现义务；具体目标由 S002-U0012~15 承载"],
  ["S002-U0007", "能力边界追问，不单独扩写为实现义务；具体目标由 S002-U0012~15 承载"],
  ["S002-U0008", "方案询问本身不定义协议；后续已对齐边界由 S002-U0012~15 承载"],
  ["S002-U0010", "一般实施授权，不作为代码包、沙箱或计数器的语义证据"],
  ["S003-U0024", "分析者提出的改进建议，不冒充 Cloudflare D1 事实；审计要求由挑战质量维度和当前模型验收策略承载"],
  ["S006-U0010", "公开页面观察后的设计建议，不是可验证产品事实"],
  ["S006-U0011", "公开页面观察后的设计建议，不是可验证产品事实"],
  ["S006-U0012", "公开页面观察后的设计建议，不是可验证产品事实"],
  ["S007-U0019", "旧 AppSpec 职责已被 CHG-010 代码包协议取代"],
  ["S007-U0024", "旧 CHG-005 模型选择结论，不作为 CHG-010 规范"],
  ["S007-U0026", "旧模型排除结论，不作为 CHG-010 规范"],
  ["S007-U0029", "旧生产模型选择已由 CHG-010 的 builder/planner 决策取代"],
  ["S007-U0032", "旧快照中的分析者发布建议；当前发布门禁由 S010-U0039~41 重新归责"],
  ["S009-U0017", "对官方列表能力边界的分析性提醒，不标为平台 FACT 或本期规范"],
  ["S010-U0012", "官方页面未出现项目级承诺属于缺失边界，不标为 Cloudflare 正向 FACT"],
  ["S011-U0035", "历史“不承诺任意代码生成”被用户 CHG-010 明确变更取代；第三方集成等其余边界由 S002/S009 保留"],
  ["S011-U0038", "历史有限模板/无外部模型取舍已被 CHG-010 明确变更取代"],
]);

const evidenceForSource = {
  S003: "EV-003",
  S004: "EV-004",
  S006: "EV-006",
  S007: "EV-007",
  S008: "EV-008",
  S009: "EV-009",
  S010: "EV-010",
};

const locationPrefixes = ["来源：", "采集日期：", "采集时间：", "环境：", "数据源："];
const tableShape = (unit) => unit.kind === "table_row" && (unit.content.includes("---") || unit.content.includes("Requirement") || unit.content.includes("来源") || unit.content.includes("维度") || unit.content.includes("前提"));

let atomSequence = 1;
let srcSequence = 1;

function atom(quote, disposition, options = {}) {
  const entry = {
    id: `ATOM-${String(atomSequence++).padStart(3, "0")}`,
    quote,
    statement: options.statement || quote,
    disposition,
  };
  if (disposition === "SRC") {
    entry.src_id = `SRC-${String(srcSequence++).padStart(3, "0")}`;
    entry.requirement_ids = options.requirementIds;
  } else if (disposition === "FACT") {
    entry.evidence_id = options.evidenceId;
  } else {
    entry.reason = options.reason || "背景或重复信息，不新增本期需求";
  }
  return entry;
}

function noRequirement(unit, reason) {
  return {
    content_sha256: unit.content_sha256,
    status: "NO_REQUIREMENT",
    reason,
    coverage_assertion: "",
    ignored: [],
    atoms: [],
  };
}

function atomized(unit, atoms, ignored = []) {
  return {
    content_sha256: unit.content_sha256,
    status: "ATOMIZED",
    reason: "",
    coverage_assertion: "FULL",
    ignored,
    atoms,
  };
}

function codeLines(unit) {
  return unit.content
    .replace(/^```[^\n]*\n/, "")
    .replace(/\n```$/, "")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function classifySitesCodeBlock(unit) {
  const parts = unit.content
    .replace(/^```[^\n]*\n/, "")
    .replace(/\n```$/, "")
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const atoms = parts.map((part, index) => {
    if (unit.unit_id === "S005-U0004") {
      const reqs = index === 2 ? ["NFR-005"] : ["FR-004", "NFR-005"];
      return atom(part, "SRC", { requirementIds: reqs });
    }
    if (index === 3) {
      return atom(part, "OUT", { reason: "是否启用 SIWC 是历史产品选型，不是本期生成代码协议" });
    }
    const reqs = index === 2 ? ["NFR-003", "NFR-005"] : ["NFR-005"];
    return atom(part, "SRC", { requirementIds: reqs });
  });
  return atomized(unit, atoms, [
    { quote: "```", reason: "Markdown 代码围栏，不承载契约" },
    { quote: "text", reason: "Markdown 代码围栏语言标记，不承载契约" },
  ]);
}

function classifyOfficialHelpBlock(unit) {
  const parts = codeLines(unit);
  const atoms = parts.map((part) => {
    if (unit.unit_id === "S008-U0008") {
      if (part === "Test the Functionality in Atoms") {
        return atom(part, "OUT", { reason: "帮助文档段落标题，不单独承载需求" });
      }
      return atom(part, "SRC", { requirementIds: ["FR-004", "NFR-005"] });
    }
    if (unit.unit_id === "S008-U0012") {
      if (part.endsWith("?")) {
        return atom(part, "OUT", { reason: "FAQ 问题标题；其下一行回答承载产品能力" });
      }
      if (part.includes("websites") || part.includes("calculators")) {
        return atom(part, "SRC", { requirementIds: ["FR-002", "FR-003"] });
      }
      if (part.includes("Describe what you need")) {
        return atom(part, "SRC", { requirementIds: ["FR-001", "FR-002", "FR-005"] });
      }
      if (part.includes("write code")) {
        return atom(part, "SRC", { requirementIds: ["FR-002", "FR-004"] });
      }
      if (part.includes("stable public link")) {
        return atom(part, "SRC", { requirementIds: ["NFR-001"] });
      }
    }
    return atom(part, "FACT", { evidenceId: "EV-008" });
  });
  return atomized(unit, atoms, [
    { quote: "```", reason: "Markdown 代码围栏，不承载产品语义" },
    { quote: "text", reason: "Markdown 代码围栏语言标记，不承载产品语义" },
  ]);
}

function classifyUnit(unit) {
  if (unit.kind === "heading") {
    return noRequirement(unit, "结构标题，不单独承载需求或事实");
  }
  if (locationPrefixes.some((prefix) => unit.content.startsWith(prefix)) || tableShape(unit)) {
    return noRequirement(unit, "来源定位、采集元数据或表格结构，不单独承载语义");
  }
  if (["S001-U0002", "S002-U0002", "S003-U0006", "S003-U0010", "S008-U0003", "S008-U0004", "S009-U0003", "S010-U0003", "S011-U0005", "S011-U0054"].includes(unit.unit_id)) {
    return noRequirement(unit, "来源说明、过渡文本或用例定位，不单独承载需求");
  }
  if (unit.source_id === "S005" && unit.kind === "code_block") {
    return classifySitesCodeBlock(unit);
  }
  if (unit.source_id === "S008" && unit.kind === "code_block") {
    return classifyOfficialHelpBlock(unit);
  }

  const reqs = requirementMap[unit.unit_id];
  if (reqs) {
    return atomized(unit, [atom(unit.content, "SRC", { requirementIds: reqs })]);
  }
  if (explicitOut.has(unit.unit_id)) {
    return atomized(unit, [atom(unit.content, "OUT", { reason: explicitOut.get(unit.unit_id) })]);
  }

  // Historical PRD is only used for the still-active version/history contract.
  // Everything else is either repeated by raw challenge/help sources or superseded.
  if (unit.source_id === "S011") {
    return atomized(unit, [atom(unit.content, "OUT", { reason: "历史 PRD 的重复或已变更内容；仅版本恢复/切换原子继续作为 CHG-010 输入" })]);
  }

  if (unit.source_id === "S012") {
    return atomized(unit, [atom(unit.content, "FACT", { evidenceId: "EV-012" })]);
  }

  if (unit.source_id === "S006" && unit.unit_id >= "S006-U0004" && unit.unit_id <= "S006-U0008") {
    return atomized(unit, [atom(unit.content, "FACT", { evidenceId: "EV-006" })]);
  }
  if (unit.source_id === "S009") {
    return atomized(unit, [atom(unit.content, "FACT", { evidenceId: "EV-009" })]);
  }
  if (unit.source_id === "S010") {
    return atomized(unit, [atom(unit.content, "FACT", { evidenceId: "EV-010" })]);
  }
  if (evidenceForSource[unit.source_id]) {
    return atomized(unit, [atom(unit.content, "FACT", { evidenceId: evidenceForSource[unit.source_id] })]);
  }

  return atomized(unit, [atom(unit.content, "OUT", { reason: "背景说明或重复表述，已由对应原子覆盖，不新增独立需求" })]);
}

const covered = {};
for (const unit of units) covered[unit.unit_id] = classifyUnit(unit);

writeFileSync(coveragePath, `${JSON.stringify({ schema_version: 1, units: covered }, null, 2)}\n`);
