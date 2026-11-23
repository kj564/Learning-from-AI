/**
 * seed-note.ts — insert a test note with chapters + content so the Mindmap
 * and Podcast tabs have data to render during browser verification.
 *
 * Uses the most recent dev user from the Subscription table (the one the
 * browser got assigned when it first loaded /api/v1/me). Prints the userId
 * so we can verify the cookie matches.
 *
 * Idempotent: deletes any existing "Fotosintesis 101" note first.
 */
import { db } from './src/lib/db';
import { randomUUID } from 'crypto';

async function main() {
  // Use the userId passed as arg, else the most recent dev user from Subscription
  let userId: string | undefined = process.argv[2];
  let sub;
  if (userId) {
    sub = await db.subscription.findUnique({ where: { userId } });
    if (!sub) {
      sub = await db.subscription.create({
        data: { userId, plan: 'free', status: 'active',
          notesResetDate: new Date(Date.now() + 7 * 864e5),
          chatResetDate: new Date(Date.now() + 7 * 864e5),
          examsResetDate: new Date(Date.now() + 7 * 864e5) },
      });
    }
  } else {
    sub = await db.subscription.findFirst({ orderBy: { userId: 'desc' } });
    if (!sub) {
      userId = `dev_${randomUUID()}`;
      sub = await db.subscription.create({
        data: { userId, plan: 'free', status: 'active',
          notesResetDate: new Date(Date.now() + 7 * 864e5),
          chatResetDate: new Date(Date.now() + 7 * 864e5),
          examsResetDate: new Date(Date.now() + 7 * 864e5) },
      });
    } else {
      userId = sub.userId;
    }
  }
  console.log('using dev userId:', userId);

  // Clean up any previous seed note
  const existing = await db.studyNote.findFirst({ where: { title: 'Fotosintesis 101' } });
  if (existing) await db.studyNote.delete({ where: { id: existing.id } });

  const note = await db.studyNote.create({
    data: {
      userId,
      title: 'Fotosintesis 101',
      description: 'Cara tumbuhan membuat makanan dari cahaya',
      content: '## Apa itu Fotosintesis?\n\nFotosintesis adalah proses di mana tumbuhan mengubah energi cahaya menjadi energi kimia. Proses ini terjadi di kloroplas daun.\n\n## Fase Terang dan Gelap\n\nFase terang terjadi di tilakoid, menghasilkan ATP dan NADPH. Fase gelap (siklus Calvin) terjadi di stroma, menghasilkan glukosa.',
      status: 'ready',
      totalChapters: 4,
      flashcardCount: 5,
      quizCount: 3,
    },
  });

  const chapters = [
    { order: 0, title: 'Pengantar Fotosintesis', content: 'Fotosintesis adalah proses konversi energi cahaya menjadi glukosa. Terjadi di kloroplas. Persamaan: 6CO2 + 6H2O + cahaya -> C6H12O6 + 6O2.' },
    { order: 1, title: 'Struktur Kloroplas', content: 'Kloroplas punya membran ganda. Bagian dalamnya ada tilakoid yang berisi klorofil. Stroma adalah cairan di sekitar tilakoid.' },
    { order: 2, title: 'Fase Terang (Light Reaction)', content: 'Terjadi di membran tilakoid. Air dipecah jadi O2, H+, dan elektron. Menghasilkan ATP dan NADPH. Melibatkan fotosistem I dan II.' },
    { order: 3, title: 'Fase Gelap (Siklus Calvin)', content: 'Terjadi di stroma. CO2 diikat oleh RuBisCO. Menghasilkan glukosa. Tidak butuh cahaya langsung tapi butuh ATP dan NADPH dari fase terang.' },
  ];

  for (const c of chapters) {
    await db.chapter.create({ data: { noteId: note.id, ...c } });
  }

  console.log('seeded note', note.id, 'with', chapters.length, 'chapters for user', userId);
  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
