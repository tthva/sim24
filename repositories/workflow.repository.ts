// ============================
// SIM24 — Workflow Repository (Enterprise)
// ============================
// Data access layer — Prisma queries only.
// No business logic.
// ============================

import { prisma } from "@/lib/prisma";
import { Prisma, type Department, type StepStatus, type WorkflowInstanceStatus } from "@prisma/client";

// ─── Workflow Definition ──────────────────────────────────────────────────

export async function findActiveWorkflowByCode(code: string) {
  return prisma.workflow.findUnique({
    where: { code, status: "ACTIVE" },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      },
    },
  });
}

export async function getSystemUser() {
  return prisma.user.findFirst({
    where: { userType: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
}

// ─── Operator Assignment (Load Balanced + RBAC + Concurrency-safe) ────────

/**
 * Explicit department → integer mapping for PostgreSQL advisory locks.
 * PRICE=1, SELL=2, PRODUCT=3, INVESTMENT=4.
 * Must stay exhaustive and in sync with the Department enum.
 */
const DEPARTMENT_LOCK_KEY: Record<Department, number> = {
  PRICE: 1,
  SELL: 2,
  PRODUCT: 3,
  INVESTMENT: 4,
};

/**
 * Fixed namespace for workflow-assignment advisory locks.
 * Chosen to avoid collision with other advisory locks in the system.
 */
const WORKFLOW_ASSIGN_LOCK_NAMESPACE = 42;

/**
 * Acquire a PostgreSQL transaction-scoped advisory lock for a department.
 * Must be called inside a transaction (locks are released on commit/rollback).
 * The lock is held until the transaction ends, serializing concurrent
 * operator-selection for the same department.
 */
export async function acquireDepartmentAssignmentLock(
  tx: Prisma.TransactionClient,
  department: Department
): Promise<void> {
  const key = DEPARTMENT_LOCK_KEY[department];
  // pg_advisory_xact_lock is a PostgreSQL built-in; parameterized via Prisma.sql
  // $executeRaw (not $queryRaw) because pg_advisory_xact_lock returns void,
  // which Prisma cannot deserialize via $queryRaw.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${WORKFLOW_ASSIGN_LOCK_NAMESPACE}::int, ${key}::int)`;
}

/**
 * Find the operator (user with role="operator") in a department with the
 * lowest active workload.
 *
 * Concurrency-safe: must be called inside a transaction, and the caller
 * should acquire the department advisory lock BEFORE calling this function
 * so the workload is computed under the lock.
 *
 * Filters:
 * - Agent.active = true
 * - Agent.department = department
 * - Agent.user.active = true
 * - Agent.user has a UserRoleAssignment with Role.code = "operator"
 *
 * Workload = number of WorkflowStepInstance where:
 * - assignedToId = operator's User.id (assignedToId references User.id)
 * - status IN (PENDING, ASSIGNED, IN_PROGRESS)
 *
 * Tie-break: lowest workload → agent.createdAt ASC → agent.id ASC.
 *
 * @param tx Prisma transaction client (NOT the global prisma client)
 * @param department The department to select an operator for
 * @returns The selected Agent (with user info) or null if no eligible operator
 */
export async function findLeastBusyOperatorByWorkload(
  tx: Prisma.TransactionClient,
  department: Department
) {
  // All queries run on the SAME transaction client (tx), never global prisma.
  const agents = await tx.agent.findMany({
    where: {
      department,
      active: true,
      user: {
        active: true,
        roleAssignments: {
          some: { role: { code: "operator" } },
        },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          username: true,
          // Active workload: PENDING / ASSIGNED / IN_PROGRESS only.
          // assignedToId references User.id (confirmed in schema).
          workflowStepAssignments: {
            where: {
              status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
            },
            select: { id: true },
          },
        },
      },
    },
  });

  if (agents.length === 0) return null;

  // Sort by workload ascending, then agent.createdAt ASC, then agent.id ASC.
  agents.sort((a, b) => {
    const workloadDiff =
      a.user.workflowStepAssignments.length - b.user.workflowStepAssignments.length;
    if (workloadDiff !== 0) return workloadDiff;

    const createdDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (createdDiff !== 0) return createdDiff;

    return a.id.localeCompare(b.id);
  });

  return agents[0];
}

export async function findAgentByUserIdAndDepartment(
  userId: string,
  department: Department
) {
  return prisma.agent.findFirst({
    where: { userId, department, active: true },
  });
}

/**
 * Transaction-scoped equivalent of findAgentByUserIdAndDepartment.
 * Must be called inside a transaction with the same tx client.
 */
export async function findAgentByUserIdAndDepartmentTx(
  tx: Prisma.TransactionClient,
  userId: string,
  department: Department
) {
  return tx.agent.findFirst({
    where: { userId, department, active: true },
  });
}

export async function findAgentByUserId(userId: string) {
  return prisma.agent.findFirst({
    where: { userId, active: true },
    include: {
      user: { select: { id: true, fullName: true, username: true } },
    },
  });
}

// ─── Agent Tasks ──────────────────────────────────────────────────────────

export async function findAgentTasks(agentUserId: string) {
  return prisma.workflowStepInstance.findMany({
    where: {
      assignedToId: agentUserId,
      status: { in: ["ASSIGNED", "IN_PROGRESS"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      step: {
        select: {
          id: true,
          stepOrder: true,
          code: true,
          title: true,
          department: true,
          formSchema: true,
          allowedActions: true,
        },
      },
      instance: {
        select: {
          id: true,
          status: true,
          formData: true,
          createdAt: true,
          dueAt: true,
          version: {
            select: {
              workflow: { select: { code: true, title: true } },
            },
          },
        },
      },
    },
  });
}

// ─── Workflow Instance ────────────────────────────────────────────────────

export async function createWorkflowInstance(data: {
  versionId: string;
  agentId: string | null;
  status: WorkflowInstanceStatus;
  formData: unknown;
  metadata?: unknown;
  currentStepOrder: number;
  customerFormId?: string;
  dueAt?: Date;
}) {
  return prisma.workflowInstance.create({
    data: {
      versionId: data.versionId,
      agentId: data.agentId,
      status: data.status,
      formData: data.formData as object,
      metadata: (data.metadata as object) ?? undefined,
      currentStepOrder: data.currentStepOrder,
      customerFormId: data.customerFormId,
      dueAt: data.dueAt,
    },
  });
}

/**
 * Transaction-scoped equivalent of createWorkflowInstance.
 * Must be called inside a transaction with the same tx client
 * used for operator selection (advisory lock) and step creation.
 */
export async function createWorkflowInstanceTx(
  tx: Prisma.TransactionClient,
  data: {
    versionId: string;
    agentId: string | null;
    status: WorkflowInstanceStatus;
    formData: unknown;
    metadata?: unknown;
    currentStepOrder: number;
    customerFormId?: string;
    dueAt?: Date;
  }
) {
  return tx.workflowInstance.create({
    data: {
      versionId: data.versionId,
      agentId: data.agentId,
      status: data.status,
      formData: data.formData as object,
      metadata: (data.metadata as object) ?? undefined,
      currentStepOrder: data.currentStepOrder,
      customerFormId: data.customerFormId,
      dueAt: data.dueAt,
    },
  });
}

export async function findWorkflowInstanceById(id: string) {
  return prisma.workflowInstance.findUnique({
    where: { id },
    include: {
      version: {
        include: {
          workflow: true,
          steps: { orderBy: { stepOrder: "asc" } },
        },
      },
      agent: {
        include: {
          user: { select: { id: true, fullName: true, username: true } },
        },
      },
      stepInstances: {
        orderBy: { createdAt: "asc" },
        include: {
          step: true,
          assignedTo: { select: { id: true, fullName: true, username: true } },
        },
      },
    },
  });
}

export async function updateWorkflowInstanceStatus(
  id: string,
  status: WorkflowInstanceStatus,
  currentStepOrder?: number
) {
  return prisma.workflowInstance.update({
    where: { id },
    data: {
      status,
      currentStepOrder,
      ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
  });
}

export async function updateWorkflowInstanceDueAt(id: string, dueAt: Date | null) {
  return prisma.workflowInstance.update({
    where: { id },
    data: { dueAt },
  });
}

// ─── Workflow Step Instance ───────────────────────────────────────────────

export async function createStepInstance(data: {
  instanceId: string;
  stepId: string;
  status: StepStatus;
  assignedToId: string | null;
  dueAt?: Date | null;
}) {
  return prisma.workflowStepInstance.create({
    data: {
      instanceId: data.instanceId,
      stepId: data.stepId,
      status: data.status,
      assignedToId: data.assignedToId,
      assignedAt: data.assignedToId ? new Date() : null,
      dueAt: data.dueAt ?? null,
    },
  });
}

/**
 * Transaction-scoped equivalent of createStepInstance.
 * Must be called inside a transaction with the same tx client
 * used for operator selection (advisory lock) and instance creation.
 */
export async function createStepInstanceTx(
  tx: Prisma.TransactionClient,
  data: {
    instanceId: string;
    stepId: string;
    status: StepStatus;
    assignedToId: string | null;
    dueAt?: Date | null;
  }
) {
  return tx.workflowStepInstance.create({
    data: {
      instanceId: data.instanceId,
      stepId: data.stepId,
      status: data.status,
      assignedToId: data.assignedToId,
      assignedAt: data.assignedToId ? new Date() : null,
      dueAt: data.dueAt ?? null,
    },
  });
}

export async function findStepInstanceById(id: string) {
  return prisma.workflowStepInstance.findUnique({
    where: { id },
    include: {
      instance: {
        include: {
          version: {
            include: {
              workflow: { select: { code: true, title: true } },
            },
          },
        },
      },
      step: true,
      assignedTo: { select: { id: true, fullName: true, username: true } },
    },
  });
}

export async function findStepInstanceByIdFull(id: string) {
  return prisma.workflowStepInstance.findUnique({
    where: { id },
    include: {
      instance: {
        include: {
          version: {
            include: {
              steps: { orderBy: { stepOrder: "asc" } },
              workflow: { select: { code: true, title: true } },
            },
          },
        },
      },
      step: true,
      assignedTo: { select: { id: true, fullName: true, username: true } },
    },
  });
}

/**
 * Get all step instances for a workflow instance (for timeline).
 */
export async function findStepInstancesByInstanceId(instanceId: string) {
  return prisma.workflowStepInstance.findMany({
    where: { instanceId },
    orderBy: { createdAt: "asc" },
    include: {
      step: { select: { id: true, stepOrder: true, code: true, title: true, department: true } },
      assignedTo: { select: { id: true, fullName: true, username: true } },
    },
  });
}

export async function updateStepInstance(
  id: string,
  data: {
    status: StepStatus;
    data?: unknown;
    formData?: unknown;
    notes?: string;
  }
) {
  return prisma.workflowStepInstance.update({
    where: { id },
    data: {
      status: data.status,
      data: (data.data as object) ?? undefined,
      formData: (data.formData as object) ?? undefined,
      notes: data.notes,
      ...(data.status === "COMPLETED" ? { completedAt: new Date() } : {}),
      ...(data.status === "IN_PROGRESS" ? { startedAt: new Date() } : {}),
    },
  });
}

/**
 * Reassign a step instance to a different user.
 */
export async function reassignStepInstance(
  id: string,
  newAssignedToId: string | null
) {
  return prisma.workflowStepInstance.update({
    where: { id },
    data: {
      assignedToId: newAssignedToId,
      assignedAt: newAssignedToId ? new Date() : null,
      status: newAssignedToId ? "ASSIGNED" : "PENDING",
    },
  });
}

/**
 * Cancel all remaining step instances for an instance.
 */
export async function cancelRemainingStepInstances(instanceId: string) {
  return prisma.workflowStepInstance.updateMany({
    where: {
      instanceId,
      status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
    },
    data: { status: "SKIPPED" },
  });
}

// ─── Audit Logging ────────────────────────────────────────────────────────

export async function createAuditLog(data: {
  actorId?: string;
  entity: string;
  entityId?: string;
  action: string;
  department?: string;
  metadata?: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: data.actorId ?? null,
      entity: data.entity,
      entityId: data.entityId,
      action: data.action as any,
      department: data.department as any ?? null,
      metadata: (data.metadata as object) ?? undefined,
    },
  });
}

/**
 * Transaction-scoped equivalent of createAuditLog.
 * Must be called inside a transaction with the same tx client.
 */
export async function createAuditLogTx(
  tx: Prisma.TransactionClient,
  data: {
    actorId?: string;
    entity: string;
    entityId?: string;
    action: string;
    department?: string;
    metadata?: unknown;
  }
) {
  return tx.auditLog.create({
    data: {
      actorId: data.actorId ?? null,
      entity: data.entity,
      entityId: data.entityId,
      action: data.action as any,
      department: data.department as any ?? null,
      metadata: (data.metadata as object) ?? undefined,
    },
  });
}

// ─── Workflow Definition (Admin) ──────────────────────────────────────────

export async function createWorkflowWithVersion(data: {
  code: string;
  title: string;
  description: string;
  department: Department;
  createdById: string;
  steps: Array<{
    stepOrder: number;
    code: string;
    title: string;
    department: Department;
    formSchema: object;
    allowedActions: string[];
    isInitial: boolean;
    isFinal: boolean;
  }>;
}) {
  return prisma.workflow.create({
    data: {
      code: data.code,
      title: data.title,
      description: data.description,
      department: data.department,
      status: "ACTIVE",
      createdById: data.createdById,
      versions: {
        create: {
          version: 1,
          schema: { steps: data.steps },
          createdById: data.createdById,
          steps: {
            create: data.steps.map((step) => ({
              stepOrder: step.stepOrder,
              code: step.code,
              title: step.title,
              department: step.department,
              formSchema: step.formSchema as object,
              allowedActions: step.allowedActions,
              isInitial: step.isInitial,
              isFinal: step.isFinal,
            })),
          },
        },
      },
    },
  });
}

export async function listWorkflows() {
  return prisma.workflow.findMany({
    where: { status: "ACTIVE" },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          steps: {
            orderBy: { stepOrder: "asc" },
            select: { id: true, stepOrder: true, code: true, title: true, department: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}