import { z } from "zod";

export const PAIRING_TTL_SECONDS = 10 * 60;
export const DEVICE_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export const PairingCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/, "pairingCode must have the format ABC-123");

export const DeviceIdSchema = z.string().uuid("deviceId must be a UUID");

export const AgentIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "agentId has an invalid format");

export const CreatePairingCodeSchema = z
  .object({ agentId: AgentIdSchema })
  .strict();

export const EnrollDeviceSchema = z
  .object({
    pairingCode: PairingCodeSchema,
    agentId: AgentIdSchema,
    deviceId: DeviceIdSchema,
  })
  .strict();

export type EnrollDeviceInput = z.infer<typeof EnrollDeviceSchema>;

export interface AgentDevice {
  deviceId: string;
  agentId: string;
  jti: string;
  createdAt: string;
  lastSeenAt?: string;
  revokedAt?: string;
}

export type AgentDevicePublic = Omit<AgentDevice, "jti"> & {
  status: "online" | "offline" | "revoked";
};

export interface PairingCodeRecord {
  agentId: string;
  createdAt: string;
  expiresAt: string;
}
