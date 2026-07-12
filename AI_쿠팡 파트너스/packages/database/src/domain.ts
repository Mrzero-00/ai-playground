import { z } from "zod";

const timestampSchema = z.iso.datetime({ offset: true });
const jsonRecordSchema = z.record(z.string(), z.unknown());

export const productSchema = z.object({
  id: z.uuid(),
  providerId: z.uuid(),
  externalProductId: z.string().min(1),
  name: z.string().min(1),
  categoryPath: z.array(z.string().min(1)),
  brand: z.string().min(1).nullable(),
  canonicalUrl: z.url().nullable(),
  imageUrl: z.url().nullable(),
  isActive: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const productSnapshotSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  price: z.number().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
  reviewCount: z.number().int().nonnegative().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  isAvailable: z.boolean().nullable(),
  rawPayload: jsonRecordSchema,
  capturedAt: timestampSchema,
});

export const workflowRunStatusSchema = z.enum([
  "PENDING", "RUNNING", "COMPLETED", "PARTIAL_FAILURE", "FAILED", "REVIEW_REQUIRED",
]);

export const workflowRunSchema = z.object({
  id: z.uuid(),
  workflowName: z.string().min(1),
  idempotencyKey: z.string().min(1),
  status: workflowRunStatusSchema,
  input: jsonRecordSchema,
  output: jsonRecordSchema.nullable(),
  error: jsonRecordSchema.nullable(),
  startedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
});

export const promptVersionSchema = z.object({
  id: z.uuid(),
  promptKey: z.string().min(1),
  version: z.number().int().positive(),
  template: z.string().min(1),
  schema: jsonRecordSchema.nullable(),
  isActive: z.boolean(),
  createdAt: timestampSchema,
});

export type Product = z.infer<typeof productSchema>;
export type ProductSnapshot = z.infer<typeof productSnapshotSchema>;
export type WorkflowRun = z.infer<typeof workflowRunSchema>;
export type PromptVersion = z.infer<typeof promptVersionSchema>;
