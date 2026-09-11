/**
 * ai4kids · 数据层（SQLite）
 *
 * 使用 Node 内置的 `node:sqlite`（Node ≥ 22.5；本项目运行 Node 24），无需任何额外依赖。
 * 数据文件：database/ai4kids.db（已被 .gitignore 忽略，部署时 git clean -fd 不会删除 Ignored 文件）
 *
 * 表 harvests —— 「收获墙」卡片：
 *   id           自增主键
 *   student      学员名（课件 #stuName）
 *   lesson       第几站（1–16）
 *   lesson_title 站名
 *   content      收获正文
 *   created_at   ISO 时间（UTC）
 */

// @types/node 目前仍是 v20，尚未包含 node:sqlite 的类型；这里只声明用得到的最小接口
interface SqliteStatement {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}
interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (filename: string) => SqliteDatabase;
};

/** 收获墙上的一张卡片 */
export interface HarvestCard {
  id: number;
  student: string;
  lesson: number;
  lessonTitle: string;
  content: string;
  createdAt: string;
}

/** 收获墙统计 */
export interface HarvestStats {
  total: number;    // 收获总数
  students: number; // 参与学员数
  lessons: number;  // 覆盖站数
}

export interface HarvestInput {
  student: string;
  lesson: number;
  lessonTitle: string;
  content: string;
}

export interface HarvestStore {
  insert(input: HarvestInput): HarvestCard;
  list(opts?: { lesson?: number; limit?: number }): HarvestCard[];
  stats(): HarvestStats;
  close(): void;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS harvests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  student      TEXT    NOT NULL,
  lesson       INTEGER NOT NULL,
  lesson_title TEXT    NOT NULL DEFAULT '',
  content      TEXT    NOT NULL,
  created_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_harvests_created ON harvests(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_harvests_student ON harvests(student);
CREATE INDEX IF NOT EXISTS idx_harvests_lesson  ON harvests(lesson);
`;

interface HarvestRow {
  id: number;
  student: string;
  lesson: number;
  lesson_title: string;
  content: string;
  created_at: string;
}

function toCard(row: HarvestRow): HarvestCard {
  return {
    id: Number(row.id),
    student: row.student,
    lesson: Number(row.lesson),
    lessonTitle: row.lesson_title,
    content: row.content,
    createdAt: row.created_at,
  };
}

/**
 * 打开（并在需要时创建）收获墙数据库
 * @param dbFile SQLite 文件路径，例如 database/ai4kids.db
 */
export function openHarvestStore(dbFile: string): HarvestStore {
  const db = new DatabaseSync(dbFile);

  // WAL 让「写入」与「读取」互不阻塞（个别文件系统不支持时忽略）
  try { db.exec('PRAGMA journal_mode = WAL;'); } catch { /* ignore */ }
  db.exec(SCHEMA);

  const insertStmt = db.prepare(
    `INSERT INTO harvests (student, lesson, lesson_title, content, created_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  const allStmt = db.prepare(
    `SELECT id, student, lesson, lesson_title, content, created_at
       FROM harvests
      ORDER BY created_at DESC, id DESC
      LIMIT ?`
  );
  const byLessonStmt = db.prepare(
    `SELECT id, student, lesson, lesson_title, content, created_at
       FROM harvests
      WHERE lesson = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?`
  );
  const statsStmt = db.prepare(
    `SELECT COUNT(*)                  AS total,
            COUNT(DISTINCT student)   AS students,
            COUNT(DISTINCT lesson)    AS lessons
       FROM harvests`
  );

  return {
    insert(input) {
      const createdAt = new Date().toISOString();
      const info = insertStmt.run(
        input.student,
        input.lesson,
        input.lessonTitle,
        input.content,
        createdAt
      );
      return {
        id: Number(info.lastInsertRowid),
        student: input.student,
        lesson: input.lesson,
        lessonTitle: input.lessonTitle,
        content: input.content,
        createdAt,
      };
    },
    list(opts = {}) {
      const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, 500) : 200;
      const rows = (opts.lesson
        ? byLessonStmt.all(opts.lesson, limit)
        : allStmt.all(limit)) as HarvestRow[];
      return rows.map(toCard);
    },
    stats() {
      const row = statsStmt.get() as { total: number; students: number; lessons: number };
      return {
        total: Number(row.total),
        students: Number(row.students),
        lessons: Number(row.lessons),
      };
    },
    close() {
      db.close();
    },
  };
}
