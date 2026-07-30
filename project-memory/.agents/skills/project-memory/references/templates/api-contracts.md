# API Contracts
# Documents API response format conventions and non-standard patterns.
# Each entry MUST carry an anchor to the controller/handler.
# Code is the single source of truth.

> git_commit: PLACEHOLDER

---

## Conventions

<!--
Each entry template:

### [API Path or Module]

**Format**: [nested / flat / hybrid]

**Description**: [What makes this non-standard]

**Example Response**:
```json
{ "key": "value" }
```

**Special Handling**:
- [What the consumer must do, and why]

**Anchor**:
- file: [controller/handler path]
- symbol: [unique grep-able handler/method name]
- lines: "[start-end]"
- hash: [short content hash]

---
-->

<!-- EXAMPLE

### GET /api/users/:id/devices

**Format**: nested

**Description**: 嵌套子资源 — 设备数据内联在 devices 数组中。

**Example Response**:
```json
{
  "id": 1,
  "name": "张三",
  "devices": [{ "id": 101, "name": "iPhone 15", "status": "active" }]
}
```

**Special Handling**:
- 前端需对 devices 数组二次解析

**Anchor**:
- file: src/controllers/UserController.ts
- symbol: getUserWithDevices
- lines: "60-85"
- hash: c4d8e0

---
-->
