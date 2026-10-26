import { Schema, model, type Types } from 'mongoose';

/**
 * A project (job) groups one or more stairs for a single site, mirroring the
 * multi-stair-per-job pattern of the onsite measure tool.
 *
 * Phase 1 records projects so Top Flyte can review what each user configured.
 * Saving/reopening/sharing (Future Considerations) builds on this same shape.
 */

interface IContact {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
}

export interface IStairConfig {
  _id: Types.ObjectId;
  label: string;
  // The configurator's StairInput as JSON (frontend: src/types/stair.ts).
  input: Record<string, unknown>;
  // Rule-engine version that produced `result`, so old results stay explainable
  // after Top Flyte edits the rule matrix.
  engineVersion: string;
  result?: {
    overall: 'pass' | 'fail';
    failCount: number;
    warnCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IProject {
  owner: Types.ObjectId;
  name: string;
  reference?: string;
  siteAddress?: string;
  purpose?: string; // "What was the configurator being used for?"
  client: IContact;
  architect: IContact;
  stairs: IStairConfig[];
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
  {
    name: { type: String, trim: true, maxlength: 100 },
    company: { type: String, trim: true, maxlength: 150 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40 },
  },
  { _id: false },
);

const stairConfigSchema = new Schema<IStairConfig>(
  {
    label: { type: String, required: true, trim: true, maxlength: 100 },
    input: { type: Schema.Types.Mixed, required: true },
    engineVersion: { type: String, required: true, maxlength: 40 },
    result: {
      overall: { type: String, enum: ['pass', 'fail'] },
      failCount: { type: Number, min: 0 },
      warnCount: { type: Number, min: 0 },
    },
  },
  { timestamps: true },
);

const projectSchema = new Schema<IProject>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    reference: { type: String, trim: true, maxlength: 80 },
    siteAddress: { type: String, trim: true, maxlength: 300 },
    purpose: { type: String, trim: true, maxlength: 500 },
    client: { type: contactSchema, default: () => ({}) },
    architect: { type: contactSchema, default: () => ({}) },
    stairs: { type: [stairConfigSchema], default: [] },
  },
  {
    collection: 'projects',
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

projectSchema.index({ owner: 1, createdAt: -1 });

export const Project = model<IProject>('Project', projectSchema);
