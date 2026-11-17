import { sql, SQL } from 'drizzle-orm';
import {
  pgTable, pgEnum, serial, bigserial, integer, text, numeric,
  boolean, timestamp, index, uniqueIndex,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('user_role', ['viewer', 'editor', 'admin']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email'),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('viewer'),
  disabled: boolean('disabled').notNull().default(false),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

export const passwordResets = pgTable('password_resets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
}, (t) => [
  index('sessions_user_idx').on(t.userId),
  index('sessions_expires_idx').on(t.expiresAt),
]);

export const statusFieldEnum = pgEnum('status_field', [
  'civil', 'layout', 'system_integrator', 'toll_notification', 'toll_operator',
]);
export const statusToneEnum = pgEnum('status_tone', [
  'done', 'progress', 'pending', 'not_feasible', 'neutral',
]);
export const fileKindEnum = pgEnum('file_kind', ['pdf', 'geo_image']);

export const zones = pgTable('zones', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
});

export const divisions = pgTable('divisions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  zoneId: integer('zone_id').references(() => zones.id),
});

export const divisionAliases = pgTable('division_aliases', {
  rawName: text('raw_name').primaryKey(),
  divisionId: integer('division_id').notNull().references(() => divisions.id),
});

export const statusOptions = pgTable('status_options', {
  id: serial('id').primaryKey(),
  field: statusFieldEnum('field').notNull(),
  label: text('label').notNull(),
  tone: statusToneEnum('tone').notNull(),
  sortOrder: integer('sort_order').notNull(),
}, (t) => [uniqueIndex('status_options_field_label_uq').on(t.field, t.label)]);

const km = (name: string) => numeric(name, { precision: 9, scale: 3 });

export const tollPlazas = pgTable('toll_plazas', {
  id: serial('id').primaryKey(),
  sNo: integer('s_no'),
  plazaCode: text('plaza_code'),
  plazaName: text('plaza_name'),
  roadName: text('road_name').notNull(),
  shName: text('sh_name'),
  entryKind: text('entry_kind').generatedAlwaysAs(
    (): SQL => sql`case when lower(trim(${tollPlazas.shName})) = 'bridge' then 'bridge' else 'road' end`,
  ),
  divisionId: integer('division_id').references(() => divisions.id),
  villageName: text('village_name'),
  chainageRaw: text('chainage_raw'),
  chainageM: integer('chainage_m'),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  coordsNeedReview: boolean('coords_need_review').notNull().default(false),

  roadLen2laneKm: km('road_len_2lane_km'),
  roadLen4laneKm: km('road_len_4lane_plus_km'),
  structLen2laneKm: km('structure_len_2lane_km'),
  structLen4laneKm: km('structure_len_4lane_plus_km'),

  roadLenTotalKm: km('road_len_total_km').generatedAlwaysAs(
    (): SQL => sql`coalesce(${tollPlazas.roadLen2laneKm},0) + coalesce(${tollPlazas.roadLen4laneKm},0)`,
  ),
  structLenTotalKm: km('structure_len_total_km').generatedAlwaysAs(
    (): SQL => sql`coalesce(${tollPlazas.structLen2laneKm},0) + coalesce(${tollPlazas.structLen4laneKm},0)`,
  ),
  totalLenKm: km('total_len_km').generatedAlwaysAs(
    (): SQL => sql`coalesce(${tollPlazas.roadLen2laneKm},0) + coalesce(${tollPlazas.roadLen4laneKm},0)
      + coalesce(${tollPlazas.structLen2laneKm},0) + coalesce(${tollPlazas.structLen4laneKm},0)`,
  ),
  equivalentLenKm: km('equivalent_len_km').generatedAlwaysAs(
    (): SQL => sql`least(
      coalesce(${tollPlazas.roadLen2laneKm},0) + coalesce(${tollPlazas.roadLen4laneKm},0)
        + 10 * (coalesce(${tollPlazas.structLen2laneKm},0) + coalesce(${tollPlazas.structLen4laneKm},0)),
      5 * (coalesce(${tollPlazas.roadLen2laneKm},0) + coalesce(${tollPlazas.roadLen4laneKm},0)
        + coalesce(${tollPlazas.structLen2laneKm},0) + coalesce(${tollPlazas.structLen4laneKm},0)))`,
  ),

  apc: numeric('apc', { precision: 10, scale: 2 }),
  plazaTypeRaw: text('plaza_type_raw'),
  plazaType: text('plaza_type'),
  locationFinalized: text('location_finalized'),

  civilStatusId: integer('civil_status_id').references(() => statusOptions.id),
  layoutStatusId: integer('layout_status_id').references(() => statusOptions.id),
  siStatusId: integer('si_status_id').references(() => statusOptions.id),
  notificationStatusId: integer('notification_status_id').references(() => statusOptions.id),
  operatorStatusId: integer('operator_status_id').references(() => statusOptions.id),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  updatedBy: integer('updated_by'),
}, (t) => [
  index('toll_plazas_division_idx').on(t.divisionId),
  index('toll_plazas_civil_idx').on(t.civilStatusId),
  index('toll_plazas_layout_idx').on(t.layoutStatusId),
  index('toll_plazas_si_idx').on(t.siStatusId),
  index('toll_plazas_notification_idx').on(t.notificationStatusId),
  index('toll_plazas_operator_idx').on(t.operatorStatusId),
  index('toll_plazas_entry_kind_idx').on(t.entryKind),
  index('toll_plazas_location_finalized_idx').on(t.locationFinalized),
]);

export const plazaFiles = pgTable('plaza_files', {
  id: serial('id').primaryKey(),
  plazaId: integer('plaza_id').notNull().references(() => tollPlazas.id, { onDelete: 'cascade' }),
  kind: fileKindEnum('kind').notNull(),
  originalName: text('original_name').notNull(),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  exifLat: numeric('exif_lat', { precision: 9, scale: 6 }),
  exifLong: numeric('exif_long', { precision: 9, scale: 6 }),
  uploadedBy: integer('uploaded_by'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  plazaId: integer('plaza_id'),
  field: text('field'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  changedBy: integer('changed_by'),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const importLog = pgTable('import_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sourceRow: integer('source_row'),
  field: text('field'),
  rawValue: text('raw_value'),
  action: text('action'),
  note: text('note'),
});
