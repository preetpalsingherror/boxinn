import { prisma } from '../src/infrastructure/db/client.ts';
import { hashPassword } from '../src/infrastructure/security/password-service.ts';
import { generateSecureToken, hashToken } from '../src/infrastructure/security/token-service.ts';

async function main() {
  console.log('Seeding fictional test data for BOX INN Member Companion...');

  // 1. Fictional Admin Account
  const adminPasswordHash = await hashPassword('AdminPass123!');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@boxinn.local' },
    update: {},
    create: {
      email: 'admin@boxinn.local',
      fullName: 'Head Coach Vikram',
      phone: '+919876543210',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date('2026-10-01T00:00:00.000Z'),
    },
  });
  console.log(`✓ Admin provisioned: ${admin.email}`);

  // 2. Fictional Active Members (Aarav Patel & Preetpal Singh)
  const memberPasswordHash = await hashPassword('MemberPass123!');
  const member = await prisma.user.upsert({
    where: { email: 'aarav@boxinn.local' },
    update: {},
    create: {
      email: 'aarav@boxinn.local',
      fullName: 'Aarav Patel',
      phone: '+919876543211',
      passwordHash: memberPasswordHash,
      role: 'MEMBER',
      status: 'ACTIVE',
      emailVerifiedAt: new Date('2026-10-01T00:00:00.000Z'),
    },
  });

  const preetPasswordHash = await hashPassword('preetpal');
  const preetMember = await prisma.user.upsert({
    where: { email: 'preet@boxinn.local' },
    update: {
      passwordHash: preetPasswordHash,
      status: 'ACTIVE',
      emailVerifiedAt: new Date('2026-10-01T00:00:00.000Z'),
    },
    create: {
      email: 'preet@boxinn.local',
      fullName: 'Preetpal Singh',
      phone: '+919876543201',
      passwordHash: preetPasswordHash,
      role: 'MEMBER',
      status: 'ACTIVE',
      emailVerifiedAt: new Date('2026-10-01T00:00:00.000Z'),
    },
  });

  // Membership for Preetpal
  await prisma.membership.upsert({
    where: { id: '00000000-0000-0000-0000-000000000099' },
    update: {
      status: 'ACTIVE',
      expiryDate: '2027-10-01',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000099',
      userId: preetMember.id,
      planName: 'Unlimited Athlete (Strength & Conditioning)',
      startDate: '2026-10-01',
      expiryDate: '2027-10-01',
      status: 'ACTIVE',
      notes: 'Annual athlete membership package',
    },
  });

  // Streaks for Preetpal
  await prisma.memberStreak.upsert({
    where: { userId: preetMember.id },
    update: {
      currentStreak: 4,
      longestStreak: 7,
      lastAttendanceDate: '2026-10-25',
      streakStartDate: '2026-10-22',
    },
    create: {
      userId: preetMember.id,
      currentStreak: 4,
      longestStreak: 7,
      lastAttendanceDate: '2026-10-25',
      streakStartDate: '2026-10-22',
    },
  });

  // Attendance history for Preetpal
  const preetSampleDates = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
  for (const date of preetSampleDates) {
    const checkIn = new Date(`${date}T01:30:00.000Z`);
    const checkOut = new Date(`${date}T03:00:00.000Z`);
    await prisma.attendanceRecord.upsert({
      where: {
        userId_gymDate: { userId: preetMember.id, gymDate: date },
      },
      update: {},
      create: {
        userId: preetMember.id,
        gymDate: date,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        source: 'ENTRANCE_QR',
        isAutoClosed: false,
      },
    });
  }
  console.log(`✓ Active member provisioned with streak & attendance: ${preetMember.email} (password: preetpal)`);

  // Membership for Aarav
  await prisma.membership.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      userId: member.id,
      planName: 'General Training (CrossFit & HYROX)',
      startDate: '2026-10-01',
      expiryDate: '2026-11-30',
      status: 'ACTIVE',
      notes: 'Quarterly membership package',
    },
  });

  // Streaks for Aarav
  await prisma.memberStreak.upsert({
    where: { userId: member.id },
    update: {},
    create: {
      userId: member.id,
      currentStreak: 3,
      longestStreak: 5,
      lastAttendanceDate: '2026-10-23',
      streakStartDate: '2026-10-21',
    },
  });

  // Attendance history for Aarav
  const sampleDates = ['2026-10-21', '2026-10-22', '2026-10-23'];
  for (const date of sampleDates) {
    const checkIn = new Date(`${date}T01:30:00.000Z`); // 07:00 AM IST (+5:30)
    const checkOut = new Date(`${date}T03:00:00.000Z`); // 08:30 AM IST
    await prisma.attendanceRecord.upsert({
      where: {
        userId_gymDate: { userId: member.id, gymDate: date },
      },
      update: {},
      create: {
        userId: member.id,
        gymDate: date,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        source: 'ENTRANCE_QR',
        isAutoClosed: false,
      },
    });
  }
  console.log(`✓ Active member provisioned with streak & attendance: ${member.email}`);

  // 3. Fictional Pending Member (Diya Sharma - claimed invitation, pending email verification)
  const pendingMember = await prisma.user.upsert({
    where: { email: 'diya@boxinn.local' },
    update: {},
    create: {
      email: 'diya@boxinn.local',
      fullName: 'Diya Sharma',
      phone: '+919876543212',
      passwordHash: memberPasswordHash,
      role: 'MEMBER',
      status: 'PENDING_VERIFICATION',
    },
  });

  await prisma.membership.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      userId: pendingMember.id,
      planName: 'Strength Training Only',
      startDate: '2026-10-24',
      expiryDate: '2026-11-24',
      status: 'ACTIVE',
    },
  });

  const sampleVerifyToken = 'test-verification-token-diya-123';
  await prisma.emailVerificationToken.upsert({
    where: { tokenHash: hashToken(sampleVerifyToken) },
    update: {},
    create: {
      userId: pendingMember.id,
      tokenHash: hashToken(sampleVerifyToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  console.log(`✓ Pending verification member provisioned: ${pendingMember.email}`);

  // 4. Fictional Machines & Exercises
  const machines = [
    {
      code: 'M-ROW-01',
      name: 'Concept2 RowErg (D-Model)',
      category: 'Conditioning / HYROX',
      location: 'Cardio & Erg Bay',
      description: 'Standard air resistance rower used in CrossFit WODs, HYROX competitions, and aerobic endurance training.',
      exercises: [
        {
          title: '500m & 2000m Erg Pacing',
          targetMuscleGroup: 'Full Body Endurance & Posterior Chain',
          instructions: 'Set damper between 4 and 6. Drive forcefully through the heels, open the hips at 11 o\'clock, and finish the pull to lower ribs with forearms horizontal.',
          formCues: JSON.stringify(['Drive through heels, open hips, then draw arms', 'Maintain 1:2 drive to recovery ratio', 'Keep damper between 4 and 6']),
          safetyPrecautions: 'Avoid rounding the lower back during the catch phase. Keep core braced throughout stroke cycle.',
          videoUrl: 'https://www.youtube-nocookie.com/embed/H00_Hk-4G-k',
          trainerName: 'Vikram',
        },
      ],
    },
    {
      code: 'M-BIKE-01',
      name: 'Rogue Echo Fan Bike',
      category: 'Conditioning / HIIT',
      location: 'Cardio & HIIT Bay',
      description: 'Heavy-duty steel fan bike delivering exponential wind resistance for anaerobic threshold conditioning and metabolic conditioning.',
      exercises: [
        {
          title: 'Tabata & Max Calorie Sprint',
          targetMuscleGroup: 'Cardiovascular / Quads / Shoulders / Core',
          instructions: 'Adjust seat pin height so knees have a slight 5-degree bend at bottom pedal stroke. Drive aggressively with quadriceps while synchronizing push-pull arm strokes.',
          formCues: JSON.stringify(['Stay upright on saddle without lateral sway', 'Synchronize push and pull arm motions with leg drive', 'Maintain steady breathing cadence through sprint']),
          safetyPrecautions: 'Ensure seat pin clicks completely into locking hole before mounting.',
          videoUrl: 'https://www.youtube-nocookie.com/embed/Y00_Hk-4G-k',
          trainerName: 'Vikram',
        },
      ],
    },
    {
      code: 'M-SKI-01',
      name: 'Concept2 SkiErg Station',
      category: 'Conditioning / Upper Body',
      location: 'Cardio & Erg Bay',
      description: 'Floor-mounted Nordic skiing ergometer building upper-body endurance, explosive hip hinging, and core strength.',
      exercises: [
        {
          title: 'Double-Pole Erg Stroke',
          targetMuscleGroup: 'Lats / Core / Triceps / Hamstrings',
          instructions: 'Grip handles slightly above eye level. Initiate downward stroke by hinging at the hips and pulling through the lats. Finish with hands past thighs.',
          formCues: JSON.stringify(['Hinge hips back as hands pass eye level', 'Engage abdominal wall on downward pull', 'Rise up on balls of feet on return']),
          safetyPrecautions: 'Initiate downward drive from the core and hips rather than yanking with upper traps.',
          videoUrl: 'https://www.youtube-nocookie.com/embed/S00_Hk-4G-k',
          trainerName: 'Vikram',
        },
      ],
    },
    {
      code: 'M-OLY-01',
      name: 'Olympic Lifting Platform & Rig',
      category: 'Strength / Weightlifting',
      location: 'Main Lifting Platforms',
      description: 'Solid hardwood drop platform with rubber shock absorption, 20kg competition Olympic barbells, and urethane bumper plates.',
      exercises: [
        {
          title: 'Clean & Jerk / Snatch Technique',
          targetMuscleGroup: 'Full Body Explosive Power / Posterior Chain',
          instructions: 'Address barbell with mid-foot alignment. Establish hook grip, lock lats, execute explosive triple extension, and catch securely in deep squat or split stance.',
          formCues: JSON.stringify(['Keep barbell tight to shins and thighs', 'Reach full vertical hip extension before pull-under', 'Punch up aggressively on catch']),
          safetyPrecautions: 'Always secure plates with spring collar clips. Keep drop perimeter clear of extra equipment.',
          videoUrl: 'https://www.youtube-nocookie.com/embed/O00_Hk-4G-k',
          trainerName: 'Vikram',
        },
      ],
    },
  ];

  for (const m of machines) {
    const machine = await prisma.machine.upsert({
      where: { code: m.code },
      update: {},
      create: {
        code: m.code,
        name: m.name,
        category: m.category,
        location: m.location,
        description: m.description,
      },
    });

    for (const ex of m.exercises) {
      const existing = await prisma.exercise.findFirst({
        where: { machineId: machine.id, title: ex.title },
      });
      if (!existing) {
        await prisma.exercise.create({
          data: {
            machineId: machine.id,
            title: ex.title,
            targetMuscleGroup: ex.targetMuscleGroup,
            instructions: ex.instructions,
            formCues: ex.formCues,
            safetyPrecautions: ex.safetyPrecautions,
            videoUrl: ex.videoUrl,
            trainerName: ex.trainerName,
          },
        });
      }
    }
  }
  console.log(`✓ Fictional gym machines and trainer-approved exercises provisioned.`);

  // 5. Announcements
  const existingAnnouncement = await prisma.announcement.findFirst({
    where: { title: 'Holiday Training Schedule' },
  });
  if (!existingAnnouncement) {
    await prisma.announcement.create({
      data: {
        title: 'Holiday Training Schedule',
        content: 'Open Gym access is available from 06:00 AM to 01:00 PM this Sunday for all active members.',
        isUrgent: false,
        createdById: admin.id,
      },
    });
    console.log(`✓ Fictional gym announcement provisioned.`);
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
