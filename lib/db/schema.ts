import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  json,
  uuid,
  text,
  primaryKey,
  foreignKey,
  boolean,
  bigint,
  integer,
} from 'drizzle-orm/pg-core';

export const user = pgTable("User", {
  id: varchar("id", { length: 42 }).primaryKey().notNull(), // Ethereum address
});

export const userKnowledge = pgTable("UserKnowledge", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: varchar("userId", { length: 42 })
    .notNull()
    .references(() => user.id),
  type: varchar("type", { enum: ["ACTION", "INTEREST", "GOAL"] }).notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
  deletedAt: timestamp("deletedAt"),
});

export const charge = pgTable("Charge", {
  id: text("id").primaryKey().notNull(),
  userId: varchar("userId", { length: 42 })
    .notNull()
    .references(() => user.id),
  status: varchar("status", {
    enum: ["NEW", "PENDING", "COMPLETED", "EXPIRED", "FAILED"],
  })
    .notNull()
    .default("NEW"),
  product: varchar("product", {
    enum: ["STARTERKIT"],
  })
    .notNull()
    .default("STARTERKIT"),
  payerAddress: varchar("payerAddress", { length: 42 }),
  amount: text("amount").notNull(),
  currency: text("currency").notNull(),
  createdAt: timestamp("createdAt").notNull(),
  confirmedAt: timestamp("confirmedAt"),
  expiresAt: timestamp("expiresAt"),
  transactionHash: text("transactionHash"),
});

export const starterKit = pgTable("StarterKit", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  creatorId: varchar("creatorId", { length: 42 }).references(() => user.id),
  claimerId: varchar("claimerId", { length: 42 }).references(() => user.id),
  chargeId: text("chargeId").references(() => charge.id),
  createdAt: timestamp("createdAt").notNull(),
  claimedAt: timestamp("claimedAt"),
  value: bigint("value", { mode: "number" }).notNull(),
  balance: bigint("balance", { mode: "number" }).notNull().default(0),
  deletedAt: timestamp("deletedAt"),
});

export type User = InferSelectModel<typeof user>;

export type UserWithRelations = User & {
  information: Array<UserKnowledge>;
  createdKits: Array<StarterKit>;
  claimedKits: Array<StarterKit>;
  charges: Array<Charge>;
};

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: varchar("userId", { length: 42 })
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type Message = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: varchar("userId", { length: 42 })
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: varchar("userId", { length: 42 })
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export const safeTransaction = pgTable("SafeTransaction", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  transactionHash: text("transactionHash").notNull().unique(),
  safeAddress: text("safeAddress").notNull(),
  transactionData: json("transactionData").notNull(),
  signatureCount: integer("signatureCount").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Suggestion = InferSelectModel<typeof suggestion>;

export type UserKnowledge = InferSelectModel<typeof userKnowledge>;

export type StarterKit = InferSelectModel<typeof starterKit>;

export type Charge = InferSelectModel<typeof charge>;

export type SafeTransaction = InferSelectModel<typeof safeTransaction>;
