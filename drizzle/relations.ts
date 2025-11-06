import { relations } from "drizzle-orm/relations";
import { authUser, authAccount, authSession } from "./schema";

export const authAccountRelations = relations(authAccount, ({one}) => ({
	authUser: one(authUser, {
		fields: [authAccount.userId],
		references: [authUser.id]
	}),
}));

export const authUserRelations = relations(authUser, ({many}) => ({
	authAccounts: many(authAccount),
	authSessions: many(authSession),
}));

export const authSessionRelations = relations(authSession, ({one}) => ({
	authUser: one(authUser, {
		fields: [authSession.userId],
		references: [authUser.id]
	}),
}));