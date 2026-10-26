export type LocationFix = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  mocked?: boolean;
};

export type CapsuleSummary = {
  id: string;
  title: string;
  placeName: string;
  createdAt: string;
  opensAt: string;
  openedAt: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  hasPhoto: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  /** Absent only in older clients/fixtures; null denotes a personal capsule. */
  groupId?: string | null;
  participantCount?: number;
};

export type AudioMimeType = 'audio/mp4' | 'audio/mpeg' | 'audio/wav';
export type VideoMimeType = 'video/mp4' | 'video/quicktime';
export type MediaAttachment = {
  base64: string;
  mimeType: AudioMimeType | VideoMimeType;
  fileName: string;
};
export type AudioAttachment = MediaAttachment & { mimeType: AudioMimeType };
export type VideoAttachment = MediaAttachment & { mimeType: VideoMimeType };

export type CapsuleContent = {
  letter: string;
  photo: { base64: string; mimeType: 'image/jpeg' | 'image/png' } | null;
  audio?: AudioAttachment | null;
  video?: VideoAttachment | null;
};

export type CreateCapsuleInput = {
  title: string;
  placeName: string;
  unlockAfterSeconds: number;
  location: LocationFix;
  content: CapsuleContent;
  /** A full, unsealed group owned by the caller. Omit for a personal capsule. */
  groupId?: string;
};

export type CapsuleGroup = {
  id: string;
  title: string;
  expectedCount: number;
  isHost: boolean;
  inviteCode: string | null;
  capsuleId: string | null;
  members: { id: string; name: string; isMe: boolean }[];
};
export type GroupResponse = { group: CapsuleGroup; serverNow: string };
export type GroupListResponse = { groups: CapsuleGroup[]; serverNow: string };
export type AttendanceStatus = {
  requiredCount: number;
  presentCount: number;
  validForSeconds: number;
  members: { id: string; name: string; isMe: boolean; present: boolean }[];
};
export type AttendanceResponse = { attendanceToken: string; eligibility: Eligibility };

export type GateCode =
  | 'READY'
  | 'TOO_EARLY'
  | 'TOO_FAR'
  | 'INACCURATE_LOCATION'
  | 'STALE_LOCATION'
  | 'WAITING_PARTICIPANTS'
  | 'MOCKED_LOCATION';

export type Eligibility = {
  eligible: boolean;
  code: GateCode;
  distanceMeters: number;
  radiusMeters: number;
  remainingSeconds: number;
  serverNow: string;
  attendance?: AttendanceStatus;
};

export type CapsuleListResponse = { capsules: CapsuleSummary[]; serverNow: string };
export type CapsuleCreateResponse = { capsule: CapsuleSummary; serverNow: string };
export type CapsuleOpenResponse = {
  capsule: CapsuleSummary;
  content: CapsuleContent;
  serverNow: string;
};
export type ApiErrorBody = { error: { code: string; message: string }; eligibility?: Eligibility };

export const CAPSULE_RADIUS_METERS = 50;
export const MAX_LOCATION_ACCURACY_METERS = 25;
export const MAX_LOCATION_AGE_MS = 30_000;
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_RECORDING_SECONDS = 60;
export const MAX_GROUP_MEMBERS = 20;
export const ATTENDANCE_TTL_MS = 20_000;
export const ATTENDANCE_REFRESH_MS = 5_000;
