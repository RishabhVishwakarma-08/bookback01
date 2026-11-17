import { z } from 'zod';
import { TEAM_PERMISSIONS } from '../models/User.js';

export const BRANCHES = ['CSE', 'IT', 'ECE', 'EE', 'ME', 'CE', 'AI & DS', 'Other'] as const;
export const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'] as const;
export const CONDITIONS = ['New', 'Like New', 'Good', 'Fair'] as const;
export const OFFER_TYPES = ['sell', 'lend', 'donate', 'exchange'] as const;
export const LISTING_STATUSES = ['available', 'reserved', 'completed', 'deactivated'] as const;
export const REQUEST_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled', 'completed'] as const;
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name too long'),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  collegeId: z
    .string()
    .trim()
    .min(4, 'College ID must be at least 4 characters')
    .max(32, 'College ID too long')
    .regex(/^[A-Za-z0-9_-]+$/, 'College ID may only contain letters, numbers, hyphens, and underscores'),
  branch: z.enum(BRANCHES),
  year: z.enum(YEARS),
  semester: z.coerce.number().int().min(1).max(8),
  campusId: z.string().trim().optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Email or College ID is required').max(120),
  password: z.string().min(1, 'Password is required').max(128),
});

export const createBookSchema = z
  .object({
    title: z.string().trim().min(2, 'Book title is required').max(160),
    author: z.string().trim().min(2, 'Author name is required').max(120),
    subject: z.string().trim().min(2, 'Subject is required').max(100),
    course: z.string().trim().max(100).optional().default(''),
    isbn: z.string().trim().max(32).optional().default(''),
    edition: z.string().trim().max(40).optional().default(''),
    branch: z.enum(BRANCHES),
    semester: z.coerce.number().int().min(1).max(8),
    condition: z.enum(CONDITIONS),
    offerType: z.enum(OFFER_TYPES),
    price: z.coerce.number().min(0, 'Price cannot be negative').max(50000).default(0),
    deposit: z.coerce.number().min(0).max(50000).optional().default(0),
    loanDurationDays: z.coerce.number().int().min(1).max(365).optional().default(30),
    quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(200).optional().default(1),
    description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
    images: z.array(z.string().trim().max(500)).max(5).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.offerType === 'sell' && data.price <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price'],
        message: 'Selling price must be greater than 0',
      });
    }
    if (data.offerType === 'donate' && data.price !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price'],
        message: 'Donated books must have price 0',
      });
    }
  });

export const updateBookSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    author: z.string().trim().min(2).max(120).optional(),
    subject: z.string().trim().min(2).max(100).optional(),
    course: z.string().trim().max(100).optional(),
    isbn: z.string().trim().max(32).optional(),
    edition: z.string().trim().max(40).optional(),
    branch: z.enum(BRANCHES).optional(),
    semester: z.coerce.number().int().min(1).max(8).optional(),
    condition: z.enum(CONDITIONS).optional(),
    offerType: z.enum(OFFER_TYPES).optional(),
    price: z.coerce.number().min(0).max(50000).optional(),
    deposit: z.coerce.number().min(0).max(50000).optional(),
    loanDurationDays: z.coerce.number().int().min(1).max(365).optional(),
    quantity: z.coerce.number().int().min(0).max(500).optional(),
    availableQuantity: z.coerce.number().int().min(0).max(500).optional(),
    description: z.string().trim().min(10).max(2000).optional(),
    status: z.enum(LISTING_STATUSES).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.quantity !== undefined &&
      data.availableQuantity !== undefined &&
      data.availableQuantity > data.quantity
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['availableQuantity'],
        message: 'Available quantity cannot exceed total quantity.',
      });
    }
  });

export const createRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(5, 'Please include a short note for the book owner (at least 5 characters)')
    .max(1000),
  pickupLocation: z.string().trim().max(140).optional().default('Main Campus Library Desk'),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(['accepted', 'rejected', 'cancelled']),
  dueDate: z.string().optional(),
});

export const createMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(1500),
});

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(3, 'Please write a brief review comment').max(600),
});

export const createReportSchema = z.object({
  listingId: z.string().trim().optional(),
  reportedUserId: z.string().trim().optional(),
  reason: z.enum(['Inappropriate Content', 'Spam or Scam', 'Wrong Book Info', 'Harassment', 'Prohibited Item', 'Other']),
  details: z.string().trim().min(5, 'Please describe the issue').max(1000),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  branch: z.enum(BRANCHES).optional(),
  year: z.enum(YEARS).optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  bio: z.string().trim().max(400).optional(),
  themePreference: z.enum(THEME_PREFERENCES).optional(),
});

const adminAccountInputSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  collegeId: z
    .string()
    .trim()
    .min(4, 'Staff/Admin ID must be at least 4 characters')
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, 'ID may only contain letters, numbers, hyphens, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  permissions: z.array(z.enum(TEAM_PERMISSIONS)).optional(),
});

export const setupInitializeSchema = z.object({
  setupKey: z.string().trim().min(8, 'Setup key is required'),
  campusName: z.string().trim().min(2).max(120).optional().default('MITS Gwalior'),
  campusDomain: z.string().trim().min(3).max(100).optional().default('mitsgwalior.in'),
  superAdmin: adminAccountInputSchema,
  teamAdmin1: adminAccountInputSchema.optional(),
  teamAdmin2: adminAccountInputSchema.optional(),
});

export const adminUpdateUserSchema = z.object({
  verified: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
  suspensionReason: z.string().trim().max(300).optional(),
  reason: z.string().trim().min(5, 'A mandatory reason (at least 5 characters) is required for administrative changes.').max(500),
});

export const adminUpdateBookSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  author: z.string().trim().min(2).max(120).optional(),
  subject: z.string().trim().min(2).max(100).optional(),
  price: z.coerce.number().min(0).max(50000).optional(),
  quantity: z.coerce.number().int().min(0).max(500).optional(),
  availableQuantity: z.coerce.number().int().min(0).max(500).optional(),
  status: z.enum(LISTING_STATUSES).optional(),
  reason: z.string().trim().min(5, 'A mandatory reason (at least 5 characters) is required for book corrections.').max(500),
});

export const adminUpdateRequestSchema = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  pickupLocation: z.string().trim().max(140).optional(),
  reason: z.string().trim().min(5, 'A mandatory reason (at least 5 characters) is required for request modifications.').max(500),
});

export const discrepancyActionSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'false_positive']).optional(),
  assignedAdminId: z.string().trim().nullable().optional(),
  resolutionSummary: z.string().trim().max(600).optional(),
  reason: z.string().trim().min(5, 'Please enter a brief review reason (at least 5 characters).').max(500),
});

export const discrepancyNoteSchema = z.object({
  note: z.string().trim().min(3, 'Investigation note must be at least 3 characters.').max(1000),
});

export const createTeamAdminSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  collegeId: z
    .string()
    .trim()
    .min(4)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/),
  password: z.string().min(8).max(128),
  permissions: z.array(z.enum(TEAM_PERMISSIONS)).min(1, 'Select at least one permission'),
  reason: z.string().trim().min(5, 'Reason is required when adding a team admin.').max(500),
});

export const updateTeamAdminSchema = z.object({
  permissions: z.array(z.enum(TEAM_PERMISSIONS)).optional(),
  isSuspended: z.boolean().optional(),
  reason: z.string().trim().min(5, 'Reason is required when updating team permissions.').max(500),
});

export const platformSettingsSchema = z.object({
  siteName: z.string().trim().min(2).max(60).optional(),
  campusName: z.string().trim().min(2).max(120).optional(),
  campusDomain: z.string().trim().min(3).max(100).optional(),
  autoVerifyCampusEmail: z.boolean().optional(),
  maxActiveRequestsPerStudent: z.coerce.number().int().min(1).max(50).optional(),
  failedLoginAlertThreshold: z.coerce.number().int().min(3).max(20).optional(),
  quantityJumpAlertThreshold: z.coerce.number().int().min(2).max(100).optional(),
  maintenanceBanner: z.string().trim().max(240).optional(),
  reason: z.string().trim().min(5, 'Reason is required for settings updates.').max(500),
});
