import { pgTable, index, bigint, varchar, integer, boolean, timestamp, serial, text, jsonb, unique, foreignKey, pgSequence, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const assignmentStatusEnum = pgEnum("AssignmentStatusEnum", ['NEEDS_SUPPORT', 'INACTIVE', 'SELF_SUFFICIENT', 'PAUSED', 'NOT_READY'])
export const infractionStatus = pgEnum("InfractionStatus", ['ACTIVE', 'EXPIRED', 'PARDONED', 'APPEALED', 'APPEAL_APPROVED', 'APPEAL_DENIED'])
export const infractionType = pgEnum("InfractionType", ['NOTE', 'WARNING', 'TIMEOUT', 'KICK', 'BAN', 'JAIL', 'VOICE_MUTE', 'VOICE_BAN'])
export const supervisionNeedEnum = pgEnum("SupervisionNeedEnum", ['PRAYER_HELP', 'QURAN_LEARNING', 'FAMILY_ISSUES', 'NEW_CONVERT_QUESTIONS', 'ARABIC_LEARNING', 'ISLAMIC_HISTORY', 'COMMUNITY_INTEGRATION', 'SPIRITUAL_GUIDANCE'])
export const ticketStatus = pgEnum("TicketStatus", ['OPEN', 'CLOSED', 'DELETED'])

export const assignmentStatusIdSeq = pgSequence("AssignmentStatus_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })
export const campaignIdSeq = pgSequence("Campaign_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })
export const infractionAppealIdSeq = pgSequence("InfractionAppeal_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })
export const infractionIdSeq = pgSequence("Infraction_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })
export const jailRolesIdSeq = pgSequence("JailRoles_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })
export const reachoutLogIdSeq = pgSequence("ReachoutLog_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })
export const revertNotionIdSeq = pgSequence("RevertNotion_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })
export const shahadaIdSeq = pgSequence("Shahada_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })
export const supervisionNeedIdSeq = pgSequence("SupervisionNeed_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })
export const supportNotificationIdSeq = pgSequence("SupportNotification_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })
export const userSupervisorEntriesIdSeq = pgSequence("UserSupervisorEntries_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })
export const userSupervisorIdSeq = pgSequence("UserSupervisor_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })

export const channel = pgTable("Channel", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	channelId: bigint("channel_id", { mode: "number" }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	categoryId: bigint("category_id", { mode: "number" }),
	position: integer().notNull(),
	isCategory: boolean("is_category").default(false).notNull(),
	deleted: boolean().default(false).notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	isDm: boolean("is_dm").default(false).notNull(),
}, (table) => [
	index("channel_category_idx").using("btree", table.categoryId.asc().nullsLast().op("int8_ops")),
]);

export const panel = pgTable("Panel", {
	id: serial().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const role = pgTable("Role", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	roleId: bigint("role_id", { mode: "number" }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	permissions: bigint({ mode: "number" }).notNull(),
	color: integer().notNull(),
	hoist: boolean().notNull(),
	managed: boolean().notNull(),
	mentionable: boolean().notNull(),
	position: integer().notNull(),
	deleted: boolean().default(false).notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const message = pgTable("Message", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	messageId: bigint("message_id", { mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	channelId: bigint("channel_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	authorId: bigint("author_id", { mode: "number" }).notNull(),
	isDeleted: boolean("is_deleted").default(false).notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	categoryId: bigint("category_id", { mode: "number" }),
	attachments: text().array(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	channelMentions: bigint("channel_mentions", { mode: "number" }).array(),
	content: text(),
	embeds: jsonb().array(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	memberMentions: bigint("member_mentions", { mode: "number" }).array(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	roleMentions: bigint("role_mentions", { mode: "number" }).array(),
	isDm: boolean("is_dm").default(false).notNull(),
}, (table) => [
	index("message_author_idx").using("btree", table.authorId.asc().nullsLast().op("int8_ops")),
	index("message_channel_idx").using("btree", table.channelId.asc().nullsLast().op("int8_ops")),
	index("message_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
]);

export const userRoles = pgTable("UserRoles", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	roleId: bigint("role_id", { mode: "number" }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("user_roles_role_id_idx").using("btree", table.roleId.asc().nullsLast().op("int8_ops")),
]);

export const ticket = pgTable("Ticket", {
	id: serial().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	channelId: bigint("channel_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	authorId: bigint("author_id", { mode: "number" }).notNull(),
	panelId: integer("panel_id").notNull(),
	status: ticketStatus().default('OPEN'),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	transcriptMessageId: bigint("transcript_message_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	ticketViewMessageId: bigint("ticket_view_message_id", { mode: "number" }),
	sequence: integer(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	controlsViewMessageId: bigint("controls_view_message_id", { mode: "number" }),
	closedAt: timestamp("closed_at", { mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	closedById: bigint("closed_by_id", { mode: "number" }),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	deletedById: bigint("deleted_by_id", { mode: "number" }),
	summary: text(),
	summaryGeneratedAt: timestamp("summary_generated_at", { mode: 'string' }),
	summaryModel: varchar("summary_model", { length: 100 }),
	summaryTokensUsed: integer("summary_tokens_used"),
}, (table) => [
	index("ticket_author_status_panel_idx").using("btree", table.authorId.asc().nullsLast().op("int4_ops"), table.status.asc().nullsLast().op("int4_ops"), table.panelId.asc().nullsLast().op("int8_ops")),
	index("ticket_channel_idx").using("btree", table.channelId.asc().nullsLast().op("int8_ops")),
]);

export const user = pgTable("User", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	discordId: bigint("discord_id", { mode: "number" }).primaryKey().notNull(),
	relationToIslam: varchar("relation_to_islam", { length: 255 }),
	gender: varchar({ length: 50 }),
	age: varchar({ length: 50 }),
	referralSource: varchar("referral_source", { length: 255 }),
	region: varchar({ length: 255 }),
	isVerified: boolean("is_verified").default(false).notNull(),
	isVoiceVerified: boolean("is_voice_verified").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	inGuild: boolean("in_guild").default(true).notNull(),
	displayName: varchar("display_name", { length: 255 }),
	name: varchar({ length: 255 }),
	nick: varchar({ length: 255 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	verifiedBy: bigint("verified_by", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	voiceVerifiedBy: bigint("voice_verified_by", { mode: "number" }),
	religiousAffiliation: varchar("religious_affiliation", { length: 255 }),
	displayAvatar: varchar("display_avatar", { length: 512 }),
});

export const authVerification = pgTable("auth_verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const authUser = pgTable("auth_user", {
	id: text().primaryKey().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	name: text().notNull(),
	image: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("auth_user_email_unique").on(table.email),
]);

export const authAccount = pgTable("auth_account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [authUser.id],
			name: "auth_account_user_id_auth_user_id_fk"
		}),
]);

export const authSession = pgTable("auth_session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [authUser.id],
			name: "auth_session_user_id_auth_user_id_fk"
		}),
	unique("auth_session_token_unique").on(table.token),
]);

export const supportNotifications = pgTable("SupportNotification", {
  id: integer("id").primaryKey().default(sql`nextval('SupportNotification_id_seq')`),

  userId: bigint("user_id", { mode: "bigint" }).notNull(),
  messageId: bigint("message_id", { mode: "bigint" }).notNull(),
  channelId: bigint("channel_id", { mode: "bigint" }).notNull(),

  assignedById: bigint("assigned_by_id", { mode: "bigint" }),
  assignedAt: timestamp("assigned_at"),

  assignmentStatusId: integer("assignment_status_id").notNull(),

  createdAt: timestamp("created_at").notNull(),
  active: boolean("active").notNull(),
});
