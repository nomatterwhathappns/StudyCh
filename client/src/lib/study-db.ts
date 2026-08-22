import Dexie, { type EntityTable } from "dexie";
import type { StudySnapshot } from "./study-types";

type StoredSnapshot = StudySnapshot & { id: "studyos"; updatedAt: number };

class StudyDatabase extends Dexie {
  snapshot!: EntityTable<StoredSnapshot, "id">;

  constructor() {
    super("studyos-v1");
    this.version(1).stores({ snapshot: "id, updatedAt" });
  }
}

export const studyDb = new StudyDatabase();

export const defaultSnapshot: StudySnapshot = {
  profile: { name: "Learner" },
  sessions: [],
  timers: [],
  activeSessionId: null,
};

export async function loadStudySnapshot(): Promise<StudySnapshot> {
  const saved = await studyDb.snapshot.get("studyos");
  if (!saved) return defaultSnapshot;
  return {
    profile: saved.profile ?? defaultSnapshot.profile,
    sessions: (saved.sessions ?? []).map((session) => ({
      ...session,
      vocabulary: (session.vocabulary ?? []).map((item) => ({
        ...item,
        review: item.review ?? { dueAt: item.createdAt, intervalDays: 0, repetitions: 0 },
      })),
    })),
    timers: saved.timers ?? [],
    activeSessionId: saved.activeSessionId ?? null,
  };
}

export async function saveStudySnapshot(snapshot: StudySnapshot) {
  await studyDb.snapshot.put({ id: "studyos", updatedAt: Date.now(), ...snapshot });
}
