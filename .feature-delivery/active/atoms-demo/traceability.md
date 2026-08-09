# Atoms AI App Builder Demo - 端到端追踪

| Requirement | Source Atom | PRD 来源 | 设计/ADR | Contract | TASK | VibeTest Case | Evidence | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-001 | SRC-002, SRC-019 | PRD 2/3 | DEC-001, DEC-008 | DESIGN-001 | TASK-001 | VT-001 | pending | FROZEN_PENDING |
| FR-002 | SRC-002, SRC-003, SRC-020, SRC-021 | PRD 2 | DEC-001, DEC-002, DEC-008 | DESIGN-001, DESIGN-002 | TASK-003 | VT-002 | pending | FROZEN_PENDING |
| FR-003 | SRC-003 | PRD 2 | DEC-001, DEC-002, DEC-005, DEC-008 | DESIGN-002 | TASK-003 | VT-002 | pending | FROZEN_PENDING |
| FR-004 | SRC-002, SRC-003, SRC-004, SRC-021 | PRD 2/3 | DEC-001, DEC-002, DEC-008 | DESIGN-002 | TASK-003 | VT-002, VT-003 | pending | FROZEN_PENDING |
| FR-005 | SRC-005 | PRD 2/9 | DEC-003, DEC-006 | DESIGN-003 | TASK-002 | VT-004, VT-010 | pending | FROZEN_PENDING |
| FR-006 | SRC-020 | PRD 2/9 | DEC-002, DEC-003, DEC-007, DEC-008 | DESIGN-002, DESIGN-003 | TASK-004 | VT-005 | pending | FROZEN_PENDING |
| NFR-001 | SRC-008, SRC-022 | PRD 7/10 | DEC-002, DEC-007, DEC-009 | DESIGN-002 | TASK-005 | VT-002, VT-006, VT-011 | pending | FROZEN_PENDING |
| NFR-002 | SRC-009 | PRD 7/10 | DEC-002 | DESIGN-002 | TASK-003 | VT-003 | pending | FROZEN_PENDING |
| NFR-003 | SRC-010 | PRD 7/10 | DEC-001, DEC-007, DEC-008 | DESIGN-001 | TASK-001 | VT-001, VT-007, VT-008 | pending | FROZEN_PENDING |
| NFR-004 | SRC-011 | PRD 7/10 | DEC-002, DEC-008 | DESIGN-002 | TASK-004 | VT-003, VT-005 | pending | FROZEN_PENDING |
| NFR-005 | SRC-007, SRC-012, SRC-022 | PRD 7/10 | DEC-003 | DESIGN-003 | TASK-005 | VT-009 | pending | FROZEN_PENDING |
| NFR-006 | SRC-001 | PRD 1/7 | DEC-008 | DESIGN-001 | TASK-005 | VT-009 | pending | FROZEN_PENDING |
| NFR-007 | SRC-006 | PRD 4/7 | DEC-002, DEC-008 | DESIGN-002 | TASK-005 | VT-002, VT-005 | pending | FROZEN_PENDING |

## CHG-003 模型接入追踪

| Requirement | 变更来源 | 设计 | TASK | VibeTest Case | Evidence | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| FR-002/003/004/006, NFR-001/002/004/005 | 用户明确批准接入真实模型；原始挑战已要求智能体驱动 | DESIGN-004 | TASK-006 | VT-016/017/018/019，并回归 VT-002/003/005/006/009 | pending | CHANGE_PENDING_FREEZE |
| NFR-003 | CHG-004 三次线上 25 秒超时证据 | DESIGN-004 长生成恢复与 55/65 秒预算 | TASK-001/006 | VT-017/018/020 | pending | CHANGE_PENDING_FREEZE |

## 安全决策追踪

| Decision | 权威输入 | 设计落点 | 验证 |
| --- | --- | --- | --- |
| DEC-006 owner 隔离 | S012 公共站匿名身份边界与服务端授权责任 | 技术方案 5/6 | VT-010 |
| DEC-007 失败保留 | SRC-008 稳定性评分 | PRD 2、技术方案 3/8 | VT-006 |
| DEC-009 输入与容量保护 | S012 服务端授权责任、SRC-008 稳定性评分 | 技术方案 6/8 | VT-007, VT-011 |
