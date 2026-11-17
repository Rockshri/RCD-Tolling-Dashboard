// Shared labels — mirror of server/src/lib/labels.ts. Keep both files in sync.
// Internal keys, URL query names and DB enum values stay unchanged.

export const STATUS_FIELD_LABELS = {
  civil: 'Status of Civil Work',
  layout: 'Status of Layout',
  system_integrator: 'Status of System Integrator',
  toll_notification: 'Status of Toll Notification',
  toll_operator: 'Name of Toll Operator',
} as const;

export type StatusFieldKey = keyof typeof STATUS_FIELD_LABELS;

export const NOT_FEASIBLE = 'Not Feasible';
export const NOT_UPDATED = 'Not updated';
export const NOT_ASSIGNED = 'Not assigned';
export const IN_PROCESS = 'In Process';
export const DONE = 'Done';
export const WORK_STARTED = 'Work started';
export const YET_TO_BE_STARTED = 'Yet to be Started';
export const YET_TO_BE_PROCESSED = 'Yet to be Processed';
export const RFP_FLOATED = 'RFP Floated';

export const LOCATION_FINALIZED_OPTIONS = ['Yes', 'Yet to be Finalized', 'Not-Feasible', 'No'] as const;
export type LocationFinalized = (typeof LOCATION_FINALIZED_OPTIONS)[number];
