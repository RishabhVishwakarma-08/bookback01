import { AuditLog } from './models/AuditLog.js';
import { BookListing } from './models/BookListing.js';
import { BookRequest } from './models/BookRequest.js';
import { Campus } from './models/Campus.js';
import { Notification } from './models/Notification.js';
import { RequestMessage } from './models/RequestMessage.js';
import { TEAM_PERMISSIONS, User } from './models/User.js';
import { getPlatformSettings } from './services/discrepancyDetector.js';
import { getAdminSetupKey, hashPassword } from './utils/security.js';

async function provisionEnvAdminsIfNeeded(campusId: any): Promise<void> {
  const existingSuper = await User.exists({ role: 'super_admin' });
  if (existingSuper) return;

  const superEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const superPassword = process.env.SUPER_ADMIN_PASSWORD?.trim();
  if (superEmail && superPassword && superPassword.length >= 8) {
    const superName = process.env.SUPER_ADMIN_NAME?.trim() || 'Super Admin';
    const superCollegeId = (process.env.SUPER_ADMIN_COLLEGE_ID?.trim() || 'SUPER001').toUpperCase();
    const superHash = await hashPassword(superPassword);
    const superUser = await User.create({
      name: superName,
      email: superEmail,
      collegeId: superCollegeId,
      branch: 'CSE',
      year: '4th Year',
      semester: 8,
      campusId,
      passwordHash: superHash,
      role: 'super_admin',
      permissions: [...TEAM_PERMISSIONS],
      verified: true,
      bio: 'Main Owner & Super Administrator',
    });

    const teamConfigs = [
      {
        name: process.env.TEAM_ADMIN_1_NAME?.trim() || 'Team Admin 1',
        email: process.env.TEAM_ADMIN_1_EMAIL?.trim().toLowerCase(),
        collegeId: (process.env.TEAM_ADMIN_1_COLLEGE_ID?.trim() || 'TEAM001').toUpperCase(),
        password: process.env.TEAM_ADMIN_1_PASSWORD?.trim(),
      },
      {
        name: process.env.TEAM_ADMIN_2_NAME?.trim() || 'Team Admin 2',
        email: process.env.TEAM_ADMIN_2_EMAIL?.trim().toLowerCase(),
        collegeId: (process.env.TEAM_ADMIN_2_COLLEGE_ID?.trim() || 'TEAM002').toUpperCase(),
        password: process.env.TEAM_ADMIN_2_PASSWORD?.trim(),
      },
    ];

    for (const tm of teamConfigs) {
      if (tm.email && tm.password && tm.password.length >= 8) {
        const exists = await User.exists({ $or: [{ email: tm.email }, { collegeId: tm.collegeId }] });
        if (!exists) {
          await User.create({
            name: tm.name,
            email: tm.email,
            collegeId: tm.collegeId,
            branch: 'CSE',
            year: '4th Year',
            semester: 8,
            campusId,
            passwordHash: await hashPassword(tm.password),
            role: 'team_admin',
            permissions: [...TEAM_PERMISSIONS],
            verified: true,
            createdByAdminId: superUser._id,
            bio: 'BookBack Team Administrator',
          });
        }
      }
    }

    await AuditLog.create({
      actorId: superUser._id,
      actorName: superUser.name,
      actorRole: superUser.role,
      action: 'provisioned initial admin team from server environment',
      targetType: 'team',
      targetId: superUser._id.toString(),
      details: `Super Admin: ${superUser.email}`,
      reason: 'Environment-configured initial admin provisioning',
      restorable: false,
    });
    console.log(`[BookBack] Super Admin provisioned from environment: ${superUser.email}`);
  } else {
    // Ensure setup key is generated and stored securely on disk without exposing it to the frontend
    getAdminSetupKey();
    console.log(
      '[BookBack Setup] No Super Admin exists yet. Visit /setup and authenticate with ADMIN_SETUP_KEY (or ./data/.setup_key) to create your Main Owner & Team Admins.',
    );
  }
}

export async function seedInitialDataIfEmpty(): Promise<void> {
  await getPlatformSettings();

  const existingCampuses = await Campus.countDocuments();
  if (existingCampuses > 0) {
    const firstCampus = await Campus.findOne();
    if (firstCampus) {
      await provisionEnvAdminsIfNeeded(firstCampus._id);
    }
    return;
  }

  console.log('[BookBack Seed] Database is empty — seeding initial campus, sample students, and books...');

  const campus = await Campus.create({
    name: 'MITS Gwalior',
    domain: 'mitsgwalior.in',
    location: 'Gwalior, Madhya Pradesh',
  });

  const [seniorHash, fresherHash, eceHash] = await Promise.all([
    hashPassword('Student@2026'),
    hashPassword('Student@2026'),
    hashPassword('Student@2026'),
  ]);

  const [senior, fresher, eceStudent] = await User.create([
    {
      name: 'Aarav Verma',
      email: 'aarav.verma@mitsgwalior.in',
      collegeId: '0901CS231014',
      branch: 'CSE',
      year: '3rd Year',
      semester: 6,
      campusId: campus._id,
      passwordHash: seniorHash,
      role: 'student',
      verified: true,
      bio: 'Final-year prep & core CS textbooks. Prefer midday handovers near the Central Library.',
    },
    {
      name: 'Priya Nair',
      email: 'priya.nair@mitsgwalior.in',
      collegeId: '0901CS251042',
      branch: 'CSE',
      year: '1st Year',
      semester: 2,
      campusId: campus._id,
      passwordHash: fresherHash,
      role: 'student',
      verified: true,
      bio: 'Looking for 2nd and 3rd semester engineering maths and data structures books.',
    },
    {
      name: 'Rohan Deshmukh',
      email: 'rohan.d@mitsgwalior.in',
      collegeId: '0901EC241019',
      branch: 'ECE',
      year: '2nd Year',
      semester: 4,
      campusId: campus._id,
      passwordHash: eceHash,
      role: 'student',
      verified: false,
      bio: 'Electronics & Communication sophomore sharing circuit analysis and signal texts.',
    },
  ]);

  const books = await BookListing.create([
    {
      ownerId: senior._id,
      campusId: campus._id,
      title: 'Introduction to Algorithms (CLRS)',
      author: 'Thomas H. Cormen, Charles E. Leiserson',
      subject: 'Data Structures & Algorithms',
      course: 'CS-301 Algorithms',
      isbn: '978-0262046305',
      edition: '4th Edition',
      branch: 'CSE',
      semester: 4,
      condition: 'Like New',
      offerType: 'sell',
      price: 480,
      quantity: 2,
      availableQuantity: 2,
      viewsCount: 42,
      requestCount: 5,
      description:
        'Clean hardcover edition with zero pen markings or torn pages. Used during 4th semester Algorithms coursework. Handover available near Central Library reading hall.',
      images: ['/src/assets/images/book_cover_algorithms_1794567285119.jpg'],
      status: 'available',
    },
    {
      ownerId: eceStudent._id,
      campusId: campus._id,
      title: 'Fundamentals of Electric Circuits',
      author: 'Charles K. Alexander, Matthew N. O. Sadiku',
      subject: 'Network Analysis & Circuits',
      course: 'EC-202 Circuit Theory',
      isbn: '978-1260226409',
      edition: '6th Edition',
      branch: 'ECE',
      semester: 3,
      condition: 'Good',
      offerType: 'lend',
      price: 0,
      deposit: 200,
      loanDurationDays: 45,
      quantity: 1,
      availableQuantity: 1,
      viewsCount: 28,
      requestCount: 3,
      description:
        'Available to borrow for the mid-sem and end-sem cycle (45 days). Light pencil notes on chapter 4 practice problems. Refundable ₹200 deposit on return.',
      images: ['/src/assets/images/book_cover_circuits_1794567285219.jpg'],
      status: 'available',
    },
    {
      ownerId: senior._id,
      campusId: campus._id,
      title: 'Higher Engineering Mathematics & Linear Algebra',
      author: 'B.S. Grewal',
      subject: 'Engineering Mathematics II',
      course: 'MA-102 Calculus & Matrices',
      isbn: '978-8193328491',
      edition: '44th Edition',
      branch: 'CSE',
      semester: 2,
      condition: 'Good',
      offerType: 'donate',
      price: 0,
      quantity: 1,
      availableQuantity: 1,
      viewsCount: 35,
      requestCount: 4,
      description:
        'Donating my 1st-year engineering mathematics textbook to an incoming student. All formula sheets intact and binding is sturdy.',
      images: ['/src/assets/images/book_cover_calculus_1794567285441.jpg'],
      status: 'available',
    },
    {
      ownerId: senior._id,
      campusId: campus._id,
      title: 'Engineering Economics & Management Principles',
      author: 'P.N. Chopra',
      subject: 'Engineering Economics',
      course: 'HU-301 Management',
      isbn: '978-9350141984',
      edition: '3rd Edition',
      branch: 'IT',
      semester: 5,
      condition: 'Like New',
      offerType: 'exchange',
      price: 0,
      quantity: 1,
      availableQuantity: 1,
      viewsCount: 18,
      requestCount: 2,
      description:
        'Open to exchanging for a 6th-semester Compiler Design or Computer Networks reference book. Kept in protective sleeve.',
      images: ['/src/assets/images/book_cover_economics_1794567286864.jpg'],
      status: 'available',
    },
    {
      ownerId: eceStudent._id,
      campusId: campus._id,
      title: 'Operating System Concepts',
      author: 'Abraham Silberschatz, Peter B. Galvin',
      subject: 'Operating Systems',
      course: 'CS-402 Systems',
      isbn: '978-1119800361',
      edition: '10th Edition',
      branch: 'CSE',
      semester: 5,
      condition: 'New',
      offerType: 'sell',
      price: 520,
      quantity: 1,
      availableQuantity: 1,
      viewsCount: 31,
      requestCount: 3,
      description:
        'Virtually unused International Student Edition. Includes untouched index tabs and chapter summary cards.',
      images: ['/src/assets/images/book_cover_algorithms_1794567285119.jpg'],
      status: 'available',
    },
    {
      ownerId: senior._id,
      campusId: campus._id,
      title: 'Discrete Mathematics and Its Applications',
      author: 'Kenneth H. Rosen',
      subject: 'Discrete Structures',
      course: 'CS-201 Discrete Math',
      isbn: '978-1259676512',
      edition: '8th Edition',
      branch: 'AI & DS',
      semester: 3,
      condition: 'Fair',
      offerType: 'lend',
      price: 0,
      deposit: 150,
      loanDurationDays: 30,
      quantity: 1,
      availableQuantity: 1,
      viewsCount: 22,
      requestCount: 2,
      description:
        'Great for 3rd semester exams and graph theory assignments. Cover edges show normal shelf wear; inside pages clean.',
      images: ['/src/assets/images/book_cover_calculus_1794567285441.jpg'],
      status: 'available',
    },
  ]);

  const sampleRequest = await BookRequest.create({
    listingId: books[0]._id,
    ownerId: senior._id,
    requesterId: fresher._id,
    offerType: 'sell',
    initialMessage: 'Hi Aarav, is CLRS still available? I can meet at the library steps tomorrow at 1 PM.',
    pickupLocation: 'Central Library Reading Hall Steps',
    status: 'pending',
  });

  await RequestMessage.create({
    requestId: sampleRequest._id,
    senderId: fresher._id,
    body: 'Hi Aarav, is CLRS still available? I can meet at the library steps tomorrow at 1 PM.',
  });

  await Notification.create({
    userId: senior._id,
    type: 'new_request',
    title: 'New book request',
    message: 'Priya Nair requested "Introduction to Algorithms (CLRS)" (sell).',
    relatedRequestId: sampleRequest._id,
    relatedListingId: books[0]._id,
  });

  await provisionEnvAdminsIfNeeded(campus._id);
  console.log('[BookBack Seed] Seeded MITS Gwalior campus, 3 sample students, 6 book listings, and 1 sample request.');
}
