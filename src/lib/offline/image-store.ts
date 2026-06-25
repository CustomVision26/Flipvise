"use client";

import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { guessImageExtension } from "../image-file";
import { getOfflineDb, isNativePlatform, persistOfflineDb } from "./db";

export const OFFLINE_LOCAL_IMAGE_PREFIX = "flipvise-local://";
const IMAGE_DIR = "flipvise-images";

export interface OfflineImageRow {
  image_id: string;
  remote_url: string | null;
  local_path: string;
  mime_type: string | null;
  pending_upload: number;
  updated_at_ms: number;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function now(): number {
  return Date.now();
}

export function isLocalImageRef(url: string | null | undefined): boolean {
  return !!url?.startsWith(OFFLINE_LOCAL_IMAGE_PREFIX);
}

export function isRemoteImageUrl(url: string | null | undefined): boolean {
  return !!url && (url.startsWith("http://") || url.startsWith("https://"));
}

export function localImageRef(imageId: string): string {
  return `${OFFLINE_LOCAL_IMAGE_PREFIX}${imageId}`;
}

export function parseLocalImageId(url: string): string | null {
  if (!isLocalImageRef(url)) return null;
  const id = url.slice(OFFLINE_LOCAL_IMAGE_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fileToBase64(file: File): Promise<string> {
  return blobToBase64(file);
}

function remoteUrlCacheKey(remoteUrl: string): string {
  let hash = 0;
  for (let i = 0; i < remoteUrl.length; i++) {
    hash = (hash << 5) - hash + remoteUrl.charCodeAt(i);
    hash |= 0;
  }
  const ext = remoteUrl.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  return `remote-${Math.abs(hash)}.${safeExt === "jpeg" ? "jpg" : safeExt}`;
}

async function writeImageBytes(
  relativePath: string,
  dataBase64: string,
): Promise<string> {
  if (isNativePlatform()) {
    await Filesystem.mkdir({
      path: IMAGE_DIR,
      directory: Directory.Data,
      recursive: true,
    }).catch(() => undefined);
    const path = `${IMAGE_DIR}/${relativePath}`;
    await Filesystem.writeFile({
      path,
      data: dataBase64,
      directory: Directory.Data,
    });
    return path;
  }
  return `data:application/octet-stream;base64,${dataBase64}`;
}

async function readImageDisplayUri(localPath: string, mimeType?: string | null): Promise<string> {
  if (localPath.startsWith("data:")) {
    if (mimeType && localPath.startsWith("data:application/octet-stream")) {
      const base64 = localPath.split(",")[1];
      return `data:${mimeType};base64,${base64}`;
    }
    return localPath;
  }
  if (!isNativePlatform()) {
    return localPath;
  }
  try {
    const { uri } = await Filesystem.getUri({
      path: localPath,
      directory: Directory.Data,
    });
    return Capacitor.convertFileSrc(uri);
  } catch {
    return localPath;
  }
}

async function upsertImageRow(row: OfflineImageRow): Promise<void> {
  const db = await getOfflineDb();
  await db.run(
    `INSERT INTO offline_images
       (image_id, remote_url, local_path, mime_type, pending_upload, updated_at_ms)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(image_id) DO UPDATE SET
       remote_url = excluded.remote_url,
       local_path = excluded.local_path,
       mime_type = excluded.mime_type,
       pending_upload = excluded.pending_upload,
       updated_at_ms = excluded.updated_at_ms;`,
    [
      row.image_id,
      row.remote_url,
      row.local_path,
      row.mime_type,
      row.pending_upload,
      row.updated_at_ms,
    ],
  );
  await persistOfflineDb();
}

async function getImageById(imageId: string): Promise<OfflineImageRow | null> {
  const db = await getOfflineDb();
  const res = await db.query(`SELECT * FROM offline_images WHERE image_id = ? LIMIT 1;`, [
    imageId,
  ]);
  return ((res.values ?? [])[0] as OfflineImageRow) ?? null;
}

async function getImageByRemoteUrl(remoteUrl: string): Promise<OfflineImageRow | null> {
  const db = await getOfflineDb();
  const res = await db.query(
    `SELECT * FROM offline_images WHERE remote_url = ? LIMIT 1;`,
    [remoteUrl],
  );
  return ((res.values ?? [])[0] as OfflineImageRow) ?? null;
}

/** Saves a picked image on-device and returns a `flipvise-local://` reference. */
export async function registerLocalImage(file: File): Promise<string> {
  const imageId = uuid();
  const ext = guessImageExtension(file.type, file.name);
  const relativePath = `pending-${imageId}.${ext}`;
  const base64 = await fileToBase64(file);
  const localPath = await writeImageBytes(relativePath, base64);
  await upsertImageRow({
    image_id: imageId,
    remote_url: null,
    local_path: localPath,
    mime_type: file.type,
    pending_upload: 1,
    updated_at_ms: now(),
  });
  return localImageRef(imageId);
}

/** Resolves a deck/card image reference for display (cached file, remote URL, or local pending). */
export async function resolveImageSrc(
  url: string | null | undefined,
  online = true,
): Promise<string | null> {
  if (!url) return null;

  if (isLocalImageRef(url)) {
    const imageId = parseLocalImageId(url);
    if (!imageId) return null;
    const row = await getImageById(imageId);
    if (!row) return null;
    return readImageDisplayUri(row.local_path, row.mime_type);
  }

  if (!isRemoteImageUrl(url)) return null;

  const cached = await getImageByRemoteUrl(url);
  if (cached) {
    return readImageDisplayUri(cached.local_path, cached.mime_type);
  }

  if (online) {
    void cacheRemoteImage(url).catch(() => undefined);
    return url;
  }

  return null;
}

/** Downloads a remote image and stores it on-device keyed by URL. */
export async function cacheRemoteImage(remoteUrl: string): Promise<void> {
  if (!isRemoteImageUrl(remoteUrl)) return;

  const existing = await getImageByRemoteUrl(remoteUrl);
  if (existing) return;

  const response = await fetch(remoteUrl);
  if (!response.ok) throw new Error(`Image download failed (${response.status})`);

  const blob = await response.blob();
  const mimeType = blob.type || "image/jpeg";
  const base64 = await blobToBase64(blob);
  const localPath = await writeImageBytes(remoteUrlCacheKey(remoteUrl), base64);

  await upsertImageRow({
    image_id: uuid(),
    remote_url: remoteUrl,
    local_path: localPath,
    mime_type: mimeType,
    pending_upload: 0,
    updated_at_ms: now(),
  });
}

/** Caches every remote image referenced by local decks and cards. */
export async function cacheLibraryImages(online: boolean): Promise<void> {
  if (!online) return;
  const db = await getOfflineDb();
  const deckRows = ((await db.query(
    `SELECT cover_image_url FROM decks WHERE deleted = 0 AND cover_image_url IS NOT NULL;`,
  )).values ?? []) as { cover_image_url: string }[];
  const cardRows = ((await db.query(
    `SELECT front_image_url, back_image_url FROM cards WHERE deleted = 0;`,
  )).values ?? []) as { front_image_url: string | null; back_image_url: string | null }[];

  const urls = new Set<string>();
  for (const row of deckRows) {
    if (isRemoteImageUrl(row.cover_image_url)) urls.add(row.cover_image_url);
  }
  for (const row of cardRows) {
    if (isRemoteImageUrl(row.front_image_url)) urls.add(row.front_image_url!);
    if (isRemoteImageUrl(row.back_image_url)) urls.add(row.back_image_url!);
  }

  for (const url of urls) {
    try {
      await cacheRemoteImage(url);
    } catch {
      // Best-effort — a single failed asset should not block sync.
    }
  }
}

export interface OfflineImageUploadOptions {
  apiBaseUrl: string;
  token: string;
}

async function readLocalImageBlob(row: OfflineImageRow): Promise<Blob> {
  if (row.local_path.startsWith("data:")) {
    const response = await fetch(row.local_path);
    return response.blob();
  }
  const file = await Filesystem.readFile({
    path: row.local_path,
    directory: Directory.Data,
  });
  const base64 = typeof file.data === "string" ? file.data : "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: row.mime_type ?? "image/jpeg" });
}

async function uploadImageFile(
  options: OfflineImageUploadOptions,
  deckServerId: number,
  file: Blob,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const formData = new FormData();
  formData.append("image", file, fileName);
  formData.append("deckServerId", String(deckServerId));

  const response = await fetch(`${options.apiBaseUrl.replace(/\/$/, "")}/api/offline/upload-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Upload failed (${response.status})`);
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

async function replaceImageRefInDb(
  table: "decks" | "cards",
  column: string,
  localRef: string,
  remoteUrl: string,
): Promise<void> {
  const db = await getOfflineDb();
  await db.run(
    `UPDATE ${table} SET ${column} = ?, updated_at_ms = ?, dirty = 1 WHERE ${column} = ?;`,
    [remoteUrl, now(), localRef],
  );
  await persistOfflineDb();
}

/**
 * Uploads pending local images when online, replacing `flipvise-local://` refs with remote URLs.
 * Decks must have a `server_id` before their images can upload.
 */
export async function uploadPendingLocalImages(
  options: OfflineImageUploadOptions,
): Promise<void> {
  const db = await getOfflineDb();

  const pendingDecks = ((await db.query(
    `SELECT local_id, server_id, cover_image_url FROM decks
     WHERE deleted = 0 AND cover_image_url LIKE ?;`,
    [`${OFFLINE_LOCAL_IMAGE_PREFIX}%`],
  )).values ?? []) as {
    local_id: string;
    server_id: number | null;
    cover_image_url: string;
  }[];

  for (const deck of pendingDecks) {
    if (deck.server_id == null) continue;
    const imageId = parseLocalImageId(deck.cover_image_url);
    if (!imageId) continue;
    const row = await getImageById(imageId);
    if (!row || row.pending_upload !== 1) continue;
    const blob = await readLocalImageBlob(row);
    const ext = guessImageExtension(row.mime_type ?? "image/jpeg");
    const remoteUrl = await uploadImageFile(
      options,
      deck.server_id,
      blob,
      `deck-cover.${ext}`,
      row.mime_type ?? "image/jpeg",
    );
    await replaceImageRefInDb("decks", "cover_image_url", deck.cover_image_url, remoteUrl);
    await upsertImageRow({
      ...row,
      remote_url: remoteUrl,
      pending_upload: 0,
      updated_at_ms: now(),
    });
  }

  const pendingCards = ((await db.query(
    `SELECT local_id, deck_local_id, deck_server_id, front_image_url, back_image_url
     FROM cards WHERE deleted = 0
       AND (front_image_url LIKE ? OR back_image_url LIKE ?);`,
    [`${OFFLINE_LOCAL_IMAGE_PREFIX}%`, `${OFFLINE_LOCAL_IMAGE_PREFIX}%`],
  )).values ?? []) as {
    local_id: string;
    deck_local_id: string;
    deck_server_id: number | null;
    front_image_url: string | null;
    back_image_url: string | null;
  }[];

  for (const card of pendingCards) {
    let deckServerId = card.deck_server_id;
    if (deckServerId == null) {
      const deckRow = ((await db.query(
        `SELECT server_id FROM decks WHERE local_id = ? LIMIT 1;`,
        [card.deck_local_id],
      )).values ?? [])[0] as { server_id: number | null } | undefined;
      deckServerId = deckRow?.server_id ?? null;
    }
    if (deckServerId == null) continue;

    for (const [column, ref] of [
      ["front_image_url", card.front_image_url],
      ["back_image_url", card.back_image_url],
    ] as const) {
      if (!ref || !isLocalImageRef(ref)) continue;
      const imageId = parseLocalImageId(ref);
      if (!imageId) continue;
      const row = await getImageById(imageId);
      if (!row || row.pending_upload !== 1) continue;
      const blob = await readLocalImageBlob(row);
      const ext = guessImageExtension(row.mime_type ?? "image/jpeg");
      const remoteUrl = await uploadImageFile(
        options,
        deckServerId,
        blob,
        `card-${column}.${ext}`,
        row.mime_type ?? "image/jpeg",
      );
      await replaceImageRefInDb("cards", column, ref, remoteUrl);
      await upsertImageRow({
        ...row,
        remote_url: remoteUrl,
        pending_upload: 0,
        updated_at_ms: now(),
      });
    }
  }
}

/** Returns null for local-only refs so the server never receives device paths. */
export function remoteUrlForPush(url: string | null | undefined): string | null {
  if (!url || isLocalImageRef(url)) return null;
  return isRemoteImageUrl(url) ? url : null;
}
