import mongoose from 'mongoose';
import { BookListing, type IBookListing } from '../models/BookListing.js';
import { BookRequest } from '../models/BookRequest.js';
import {
  Discrepancy,
  type DiscrepancySeverity,
  type DiscrepancyType,
} from '../models/Discrepancy.js';
import { PlatformSetting, type IPlatformSetting } from '../models/PlatformSetting.js';
import { Transaction } from '../models/Transaction.js';
import { User, type IUser } from '../models/User.js';

export async function getPlatformSettings(): Promise<IPlatformSetting> {
  let settings = await PlatformSetting.findOne({ key: 'global' });
  if (!settings) {
    settings = await PlatformSetting.create({ key: 'global' });
  }
  return settings;
}

async function generateIssueId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await Discrepancy.countDocuments();
  const seq = String(count + 1).padStart(4, '0');
  const randomSuffix = Math.floor(10 + Math.random() * 89);
  const candidate = `DSC-${year}-${seq}`;
  const exists = await Discrepancy.exists({ issueId: candidate });
  return exists ? `DSC-${year}-${seq}-${randomSuffix}` : candidate;
}

export interface RecordDiscrepancyInput {
  type: DiscrepancyType;
  severity: DiscrepancySeverity;
  description: string;
  relatedModel: 'BookListing' | 'BookRequest' | 'User' | 'Transaction';
  relatedRecordId: string;
  relatedUserId?: mongoose.Types.ObjectId | string;
  autoDetected?: boolean;
}

/**
 * Records a human-reviewable discrepancy report without ever auto-suspending or auto-accusing a user.
 * Deduplicates open/investigating records of the exact same type + target record.
 */
export async function recordDiscrepancy(input: RecordDiscrepancyInput) {
  const existingOpen = await Discrepancy.findOne({
    type: input.type,
    relatedRecordId: input.relatedRecordId,
    status: { $in: ['open', 'investigating'] },
  });

  if (existingOpen) {
    existingOpen.description = input.description;
    if (
      severityWeight(input.severity) > severityWeight(existingOpen.severity)
    ) {
      existingOpen.severity = input.severity;
    }
    await existingOpen.save();
    return existingOpen;
  }

  const issueId = await generateIssueId();
  return Discrepancy.create({
    issueId,
    type: input.type,
    severity: input.severity,
    description: input.description,
    relatedModel: input.relatedModel,
    relatedRecordId: input.relatedRecordId,
    relatedUserId: input.relatedUserId
      ? new mongoose.Types.ObjectId(input.relatedUserId.toString())
      : undefined,
    status: 'open',
    autoDetected: input.autoDetected ?? true,
  });
}

function severityWeight(s: DiscrepancySeverity): number {
  switch (s) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

export async function checkQuantityAnomaly(
  listing: IBookListing,
  prevQuantity: number,
  nextQuantity: number,
  actorId: mongoose.Types.ObjectId | string,
): Promise<void> {
  try {
    const settings = await getPlatformSettings();
    const delta = Math.abs(nextQuantity - prevQuantity);
    if (delta >= settings.quantityJumpAlertThreshold || nextQuantity >= 25) {
      await recordDiscrepancy({
        type: 'quantity_anomaly',
        severity: nextQuantity >= 50 || delta >= 15 ? 'high' : 'medium',
        description: `Unusual quantity change on "${listing.title}": changed from ${prevQuantity} to ${nextQuantity} (delta ${delta}). Please verify physical copy count.`,
        relatedModel: 'BookListing',
        relatedRecordId: listing._id.toString(),
        relatedUserId: actorId,
      });
    }
  } catch (err) {
    console.error('Discrepancy detector (quantity_anomaly) error:', err);
  }
}

export async function checkDuplicateListing(listing: IBookListing): Promise<void> {
  try {
    const duplicateFilter: Record<string, unknown>[] = [
      {
        title: new RegExp(`^${listing.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        author: new RegExp(`^${listing.author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      },
    ];
    if (listing.isbn && listing.isbn.trim().length >= 6) {
      duplicateFilter.push({ isbn: listing.isbn.trim() });
    }

    const dupes = await BookListing.find({
      _id: { $ne: listing._id },
      ownerId: listing.ownerId,
      status: { $ne: 'deactivated' },
      $or: duplicateFilter,
    })
      .select('title isbn status')
      .lean();

    if (dupes.length > 0) {
      await recordDiscrepancy({
        type: 'duplicate_listing',
        severity: 'medium',
        description: `Possible duplicate listing for "${listing.title}" by the same student (${dupes.length} matching active/reserved listing${dupes.length > 1 ? 's' : ''}).`,
        relatedModel: 'BookListing',
        relatedRecordId: listing._id.toString(),
        relatedUserId: listing.ownerId,
      });
    }
  } catch (err) {
    console.error('Discrepancy detector (duplicate_listing) error:', err);
  }
}

export async function checkSuspiciousRequests(
  requesterId: mongoose.Types.ObjectId | string,
  requestId: mongoose.Types.ObjectId | string,
): Promise<void> {
  try {
    const settings = await getPlatformSettings();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const [recentBurstCount, activeCount] = await Promise.all([
      BookRequest.countDocuments({
        requesterId,
        createdAt: { $gte: tenMinutesAgo },
      }),
      BookRequest.countDocuments({
        requesterId,
        status: { $in: ['pending', 'accepted'] },
      }),
    ]);

    if (recentBurstCount >= 4 || activeCount > settings.maxActiveRequestsPerStudent) {
      await recordDiscrepancy({
        type: 'suspicious_request',
        severity: recentBurstCount >= 6 ? 'high' : 'medium',
        description: `High borrowing/request velocity detected for student: ${recentBurstCount} requests in 10 minutes (${activeCount} total active requests; campus limit ${settings.maxActiveRequestsPerStudent}). Needs human review.`,
        relatedModel: 'BookRequest',
        relatedRecordId: requestId.toString(),
        relatedUserId: requesterId,
      });
    }
  } catch (err) {
    console.error('Discrepancy detector (suspicious_request) error:', err);
  }
}

export async function checkAvailabilityMismatch(listing: IBookListing): Promise<void> {
  try {
    const issues: string[] = [];
    if (listing.availableQuantity > listing.quantity) {
      issues.push(`availableQuantity (${listing.availableQuantity}) exceeds total quantity (${listing.quantity})`);
    }
    if (listing.status === 'available' && listing.availableQuantity <= 0) {
      issues.push('listing status is "available" while availableQuantity is 0');
    }
    if (listing.status === 'reserved') {
      const activeReq = await BookRequest.exists({ listingId: listing._id, status: 'accepted' });
      const activeTx = await Transaction.exists({ listingId: listing._id, status: 'active' });
      if (!activeReq && !activeTx) {
        issues.push('listing is marked "reserved" without an accepted request or active transaction');
      }
    }

    if (issues.length > 0) {
      await recordDiscrepancy({
        type: 'availability_mismatch',
        severity: 'medium',
        description: `Availability mismatch on "${listing.title}": ${issues.join('; ')}.`,
        relatedModel: 'BookListing',
        relatedRecordId: listing._id.toString(),
        relatedUserId: listing.ownerId,
      });
    }
  } catch (err) {
    console.error('Discrepancy detector (availability_mismatch) error:', err);
  }
}

export async function recordUnauthorizedModificationAttempt(
  actor: IUser,
  relatedModel: 'BookListing' | 'BookRequest' | 'User' | 'Transaction',
  relatedRecordId: string,
  attemptedAction: string,
): Promise<void> {
  try {
    await recordDiscrepancy({
      type: 'unauthorized_modification',
      severity: 'high',
      description: `Unauthorized modification attempt by ${actor.name} (${actor.collegeId}, role: ${actor.role}) on ${relatedModel} ${relatedRecordId}: ${attemptedAction}.`,
      relatedModel,
      relatedRecordId,
      relatedUserId: actor._id,
    });
  } catch (err) {
    console.error('Discrepancy detector (unauthorized_modification) error:', err);
  }
}

export async function recordFailedLoginDiscrepancy(
  user: IUser,
  attempts: number,
): Promise<void> {
  try {
    await recordDiscrepancy({
      type: 'repeated_failed_login',
      severity: attempts >= 10 ? 'critical' : 'high',
      description: `${attempts} consecutive failed sign-in attempts recorded on account ${user.name} (${user.email}). Account remains active pending administrator review.`,
      relatedModel: 'User',
      relatedRecordId: user._id.toString(),
      relatedUserId: user._id,
    });
  } catch (err) {
    console.error('Discrepancy detector (repeated_failed_login) error:', err);
  }
}

/**
 * Runs an on-demand consistency scan across books, requests, and user failed login counters.
 */
export async function runConsistencyScan(): Promise<{ createdOrUpdated: number }> {
  let detected = 0;
  const settings = await getPlatformSettings();

  const listings = await BookListing.find({ status: { $ne: 'deactivated' } });
  const seenKeys = new Map<string, IBookListing>();

  for (const listing of listings) {
    if (
      listing.availableQuantity > listing.quantity ||
      (listing.status === 'available' && listing.availableQuantity <= 0)
    ) {
      await checkAvailabilityMismatch(listing);
      detected += 1;
    } else if (listing.status === 'reserved') {
      const hasAccepted = await BookRequest.exists({ listingId: listing._id, status: 'accepted' });
      if (!hasAccepted) {
        await checkAvailabilityMismatch(listing);
        detected += 1;
      }
    }

    const dedupeKey = `${listing.ownerId.toString()}::${listing.title.trim().toLowerCase()}::${listing.author.trim().toLowerCase()}`;
    if (seenKeys.has(dedupeKey)) {
      await recordDiscrepancy({
        type: 'duplicate_listing',
        severity: 'medium',
        description: `Duplicate active listing detected for "${listing.title}" by the same student.`,
        relatedModel: 'BookListing',
        relatedRecordId: listing._id.toString(),
        relatedUserId: listing.ownerId,
      });
      detected += 1;
    } else {
      seenKeys.set(dedupeKey, listing);
    }
  }

  const flaggedUsers = await User.find({
    failedLoginAttempts: { $gte: settings.failedLoginAlertThreshold },
  });
  for (const u of flaggedUsers) {
    await recordFailedLoginDiscrepancy(u, u.failedLoginAttempts);
    detected += 1;
  }

  return { createdOrUpdated: detected };
}
