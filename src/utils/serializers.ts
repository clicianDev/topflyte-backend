import type { Types } from 'mongoose';
import type { ActivityDTO, ContactDTO, ProjectDTO, StairConfigDTO, UserDTO } from '../contracts/api.ts';
import type { IActivityLog } from '../models/ActivityLog.model.ts';
import type { IProject, IStairConfig } from '../models/Project.model.ts';
import type { IUser } from '../models/User.model.ts';

/**
 * Document → contract DTO. Controllers send these, never raw documents, so the
 * response shape is pinned to contracts/api.ts and secrets can't leak.
 */

// Accepts hydrated documents and `.lean()` results alike.
type WithId<T> = T & { _id: Types.ObjectId };

const iso = (d?: Date | null) => (d ? d.toISOString() : undefined);
const idOf = (v?: Types.ObjectId | null) => (v ? v.toString() : undefined);

export function toUserDTO(u: WithId<IUser>): UserDTO {
  return {
    _id: u._id.toString(),
    name: u.name,
    email: u.email,
    company: u.company,
    phone: u.phone,
    role: u.role,
    status: u.status,
    access: {
      requestedAt: iso(u.access?.requestedAt),
      requestMessage: u.access?.requestMessage,
      reviewedAt: iso(u.access?.reviewedAt),
      reviewedBy: idOf(u.access?.reviewedBy),
      approvedAt: iso(u.access?.approvedAt),
      decisionNote: u.access?.decisionNote,
    },
    stats: {
      loginCount: u.stats.loginCount,
      configuratorUseCount: u.stats.configuratorUseCount,
      projectCount: u.stats.projectCount,
      lastLoginAt: iso(u.stats.lastLoginAt),
      lastActivityAt: iso(u.stats.lastActivityAt),
    },
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

function toContactDTO(c?: ContactDTO | null): ContactDTO {
  return { name: c?.name, company: c?.company, email: c?.email, phone: c?.phone };
}

function toStairConfigDTO(s: IStairConfig): StairConfigDTO {
  return {
    _id: s._id.toString(),
    label: s.label,
    input: s.input,
    engineVersion: s.engineVersion,
    result: s.result?.overall
      ? { overall: s.result.overall, failCount: s.result.failCount ?? 0, warnCount: s.result.warnCount ?? 0 }
      : undefined,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function toProjectDTO(p: WithId<IProject>): ProjectDTO {
  return {
    _id: p._id.toString(),
    owner: p.owner.toString(),
    name: p.name,
    reference: p.reference,
    siteAddress: p.siteAddress,
    purpose: p.purpose,
    client: toContactDTO(p.client),
    architect: toContactDTO(p.architect),
    stairs: p.stairs.map(toStairConfigDTO),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toActivityDTO(a: WithId<IActivityLog>): ActivityDTO {
  return {
    _id: a._id.toString(),
    user: idOf(a.user),
    actor: idOf(a.actor),
    action: a.action,
    project: idOf(a.project),
    email: a.email,
    metadata: a.metadata,
    createdAt: a.createdAt.toISOString(),
  };
}
