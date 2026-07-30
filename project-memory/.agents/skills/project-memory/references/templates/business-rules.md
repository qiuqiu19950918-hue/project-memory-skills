# Business Rules
# Documents special business rules not obvious from the data model alone.
# Each rule MUST carry an anchor to where it is enforced in code.
# Code is the single source of truth.

> git_commit: PLACEHOLDER

---

## Rules

<!--
Each rule template:

### Rule #N: [Rule Name]

**Description**: [What the rule enforces]

**Conditions**:
- [Condition 1]

**Constraints**:
- [What is prohibited/required]

**Affected Entities**: [Entity A], [Entity B]

**Anchor**:
- file: [repo-relative path]
- symbol: [unique grep-able function/method name]
- lines: "[start-end]"
- hash: [short content hash]

---
-->

<!-- EXAMPLE

### Rule #1: 删除用户前检查未归还设备

**Description**: 删除用户前必须检查是否还有未归还设备。

**Conditions**:
- 用户发起删除操作

**Constraints**:
- 存在未归还设备（status != 'returned'）时拒绝删除

**Affected Entities**: User, Device

**Anchor**:
- file: src/services/UserService.ts
- symbol: deleteUser
- lines: "45-72"
- hash: 3f9b21

---
-->
