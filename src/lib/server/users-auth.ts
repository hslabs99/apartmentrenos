import {
  DEFAULT_DEV_PASSWORD,
  DEFAULT_DEV_USERNAME,
} from "@/lib/auth-defaults";
import { FieldValue } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  isUsersMetaDocument,
  USERS_COLLECTION_META_ID,
} from "@/lib/firestore/users-collection";
import { normalizeUserType } from "@/types/user";
import type { UserType } from "@/types/user";

export type AuthUserRecord = {
  id: string;
  username: string;
  type: UserType;
  passwordHash: string;
};

export type AuthenticatedUser = {
  id: string;
  username: string;
  type: UserType;
};

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export async function findUserByUsername(username: string): Promise<AuthUserRecord | null> {
  const db = getAdminFirestore();
  const snap = await db.collection("users").get();
  const needle = normalizeUsername(username);
  for (const doc of snap.docs) {
    if (isUsersMetaDocument(doc.id)) continue;
    const data = doc.data();
    if (normalizeUsername(String(data.username ?? "")) !== needle) continue;
    return {
      id: doc.id,
      username: String(data.username ?? "").trim(),
      type: normalizeUserType(data.type),
      passwordHash: String(data.passwordHash ?? ""),
    };
  }
  return null;
}

async function ensureUsersCollectionMeta(): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection("users").doc(USERS_COLLECTION_META_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      kind: "collection_bootstrap",
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

/** Creates the default dev admin user when missing (tbl-users only). */
export async function ensureDefaultDevUser(): Promise<void> {
  const existing = await findUserByUsername(DEFAULT_DEV_USERNAME);
  if (existing) return;

  await ensureUsersCollectionMeta();
  const db = getAdminFirestore();
  const passwordHash = await bcrypt.hash(DEFAULT_DEV_PASSWORD, 10);
  await db.collection("users").add({
    username: DEFAULT_DEV_USERNAME,
    email: "mike@localhost",
    phone: "",
    type: "admin",
    businessName: null,
    relationshipTypeLookupId: null,
    passwordHash,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function authenticateUser(
  username: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const trimmedUsername = username.trim();
  if (!trimmedUsername || !password) return null;

  if (
    normalizeUsername(trimmedUsername) === normalizeUsername(DEFAULT_DEV_USERNAME) &&
    password === DEFAULT_DEV_PASSWORD
  ) {
    await ensureDefaultDevUser();
  }

  const record = await findUserByUsername(trimmedUsername);
  if (!record?.passwordHash) return null;

  const ok = await bcrypt.compare(password, record.passwordHash);
  if (!ok) return null;

  return {
    id: record.id,
    username: record.username,
    type: record.type,
  };
}
