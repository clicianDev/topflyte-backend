import { describe, expect, it } from 'vitest';
import { ActivityLog } from '../src/models/ActivityLog.model.ts';
import { Project } from '../src/models/Project.model.ts';
import { User } from '../src/models/User.model.ts';
import { toActivityDTO, toProjectDTO, toUserDTO } from '../src/utils/serializers.ts';
import { useTestDatabase } from './helpers/db.ts';

useTestDatabase();

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('toUserDTO', () => {
  it('sends strings for ids/dates and never the password hash or session version', async () => {
    const admin = await User.create({ name: 'Admin', email: 'admin@x.nz', role: 'admin', status: 'approved' });
    const u = new User({
      name: 'Jane',
      email: 'jane@x.nz',
      status: 'approved',
      access: { requestedAt: new Date(), reviewedBy: admin._id, approvedAt: new Date() },
    });
    await u.setPassword('a-long-enough-password');
    await u.save();

    const dto = toUserDTO((await User.findById(u._id).select('+passwordHash'))!);
    expect(dto._id).toBe(u._id.toString());
    expect(dto.access.reviewedBy).toBe(admin._id.toString());
    expect(dto.access.approvedAt).toMatch(ISO);
    expect(dto.createdAt).toMatch(ISO);
    expect(dto.stats).toMatchObject({ loginCount: 0, configuratorUseCount: 0, projectCount: 0 });

    const json = JSON.stringify(dto);
    expect(json).not.toContain('passwordHash');
    expect(json).not.toContain('sessionVersion');
    expect(json).not.toContain('$2'); // no bcrypt hash anywhere
  });
});

describe('toProjectDTO', () => {
  it('flattens owner and stair ids, keeps the stored input and result', async () => {
    const owner = await User.create({ name: 'Jane', email: 'jane@x.nz' });
    const p = await Project.create({
      owner: owner._id,
      name: 'Smith residence',
      stairs: [
        { label: 'Main', input: { layout: 'straight', riserCount: 15 }, engineVersion: '0.1.0', result: { overall: 'pass', failCount: 0, warnCount: 1 } },
        { label: 'Garage', input: { layout: 'straight' }, engineVersion: '0.1.0' },
      ],
    });

    const dto = toProjectDTO(p);
    expect(dto.owner).toBe(owner._id.toString());
    expect(dto.stairs[0]).toMatchObject({ label: 'Main', input: { riserCount: 15 }, result: { overall: 'pass', warnCount: 1 } });
    expect(dto.stairs[0]._id).toMatch(/^[a-f0-9]{24}$/);
    expect(dto.stairs[1].result).toBeUndefined();
    expect(dto.client).toEqual({ name: undefined, company: undefined, email: undefined, phone: undefined });
  });
});

describe('toActivityDTO', () => {
  it('converts references to id strings', async () => {
    const u = await User.create({ name: 'Jane', email: 'jane@x.nz' });
    const a = await ActivityLog.create({ user: u._id, action: 'login', ip: '10.0.0.1' });
    const dto = toActivityDTO(a);
    expect(dto).toMatchObject({ user: u._id.toString(), action: 'login' });
    expect(dto.createdAt).toMatch(ISO);
    expect('ip' in dto).toBe(false); // IPs stay server-side
  });
});
