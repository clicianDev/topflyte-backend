import type { Types } from 'mongoose';
import { env } from '../config/env.ts';
import type { UserStatus } from '../contracts/api.ts';
import { Project } from '../models/Project.model.ts';
import { User } from '../models/User.model.ts';
import { recordActivity } from './activityLogger.ts';

/**
 * Development / test data: one user in each access state, a project with a passing
 * and a failing stair, and matching activity. Used to build and demo the admin
 * panel (Phase 9) without real customer data. Refuses to run in production.
 */

export const DEMO_EMAIL_DOMAIN = 'demo.topflyte.test';
/** Login password for the approved demo user (Phase 8). Development only. */
export const DEMO_PASSWORD = 'demo-password-123';

export interface DemoSeedResult {
  created: boolean;
  users: number;
  projects: number;
}

interface DemoUserSpec {
  name: string;
  local: string;
  company: string;
  status: UserStatus;
  requestMessage: string;
  decisionNote?: string;
}

const DEMO_USERS: DemoUserSpec[] = [
  {
    name: 'Aroha Ngata',
    local: 'aroha',
    company: 'Studio Ngata Architects',
    status: 'approved',
    requestMessage: 'Checking stair designs for residential consent drawings.',
  },
  {
    name: 'Ben Carter',
    local: 'ben',
    company: 'Carter Build Ltd',
    status: 'pending',
    requestMessage: 'Builder — want to check stair options before quoting.',
  },
  {
    name: 'Sam Lee',
    local: 'sam',
    company: 'Homeowner',
    status: 'declined',
    requestMessage: 'Renovating my house.',
    decisionNote: 'Not a building professional — referred to the sales team.',
  },
  {
    name: 'Priya Shah',
    local: 'priya',
    company: 'Shah Design',
    status: 'disabled',
    requestMessage: 'Interior design projects.',
    decisionNote: 'Left Shah Design — access disabled at the company’s request.',
  },
];

// Matches the frontend's DEFAULT_STAIR_INPUT (passes) and a design that fails three checks.
const PASSING_STAIR = { layout: 'straight', classification: 'main_private', totalRiseMm: 2700, riserCount: 15, goingMm: 255, nosingMm: 25, widthMm: 900 };
const FAILING_STAIR = { ...PASSING_STAIR, totalRiseMm: 2700, riserCount: 14, goingMm: 240, widthMm: 800 };

export async function seedDemoData(): Promise<DemoSeedResult> {
  if (env.NODE_ENV === 'production') throw new Error('Demo data is for development and testing only.');

  const demoEmail = new RegExp(`@${DEMO_EMAIL_DOMAIN.replaceAll('.', '\\.')}$`);
  if (await User.exists({ email: demoEmail })) return { created: false, users: 0, projects: 0 };

  const admin = await User.findOne({ role: 'admin' });
  const actor = admin?._id;
  const now = new Date();
  const users: Record<string, Types.ObjectId> = {};

  for (const spec of DEMO_USERS) {
    const reviewed = spec.status !== 'pending';
    const everApproved = spec.status === 'approved' || spec.status === 'disabled';
    const user = new User({
      name: spec.name,
      email: `${spec.local}@${DEMO_EMAIL_DOMAIN}`,
      company: spec.company,
      status: spec.status,
      access: {
        requestedAt: now,
        requestMessage: spec.requestMessage,
        reviewedAt: reviewed ? now : undefined,
        reviewedBy: reviewed ? actor : undefined,
        approvedAt: everApproved ? now : undefined,
        decisionNote: spec.decisionNote,
      },
    });
    if (everApproved) await user.setPassword(DEMO_PASSWORD);
    await user.save();
    users[spec.local] = user._id;

    const base = { user: user._id, email: user.email, metadata: { source: 'demo-seed' } };
    await recordActivity({ ...base, action: 'access_requested' });
    if (spec.status === 'declined') await recordActivity({ ...base, actor, action: 'access_declined' });
    if (everApproved) await recordActivity({ ...base, actor, action: 'access_approved' });
    if (spec.status === 'disabled') {
      await recordActivity({ ...base, action: 'login' });
      await recordActivity({ ...base, actor, action: 'access_disabled' });
    }
  }

  const aroha = users.aroha;
  const project = await Project.create({
    owner: aroha,
    name: 'Ngata residence',
    reference: 'TF-DEMO-001',
    siteAddress: '12 Example Street, Wellington',
    purpose: 'Consent drawings for a two-storey house',
    client: { name: 'J. & M. Smith' },
    architect: { name: 'Aroha Ngata', company: 'Studio Ngata Architects', email: `aroha@${DEMO_EMAIL_DOMAIN}` },
    stairs: [
      { label: 'Main stair', input: PASSING_STAIR, engineVersion: '0.1.0', result: { overall: 'pass', failCount: 0, warnCount: 0 } },
      { label: 'Garage stair', input: FAILING_STAIR, engineVersion: '0.1.0', result: { overall: 'fail', failCount: 3, warnCount: 0 } },
    ],
  });

  const base = { user: aroha, email: `aroha@${DEMO_EMAIL_DOMAIN}`, metadata: { source: 'demo-seed' } };
  for (const action of ['login', 'configurator_opened', 'login', 'configurator_opened'] as const) {
    await recordActivity({ ...base, action });
  }
  await recordActivity({ ...base, action: 'project_created', project: project._id });
  await recordActivity({ ...base, action: 'pdf_exported', project: project._id, metadata: { stair: 'Main stair' } });
  await recordActivity({ ...base, action: 'dxf_exported', project: project._id, metadata: { stair: 'Main stair' } });

  return { created: true, users: DEMO_USERS.length, projects: 1 };
}
