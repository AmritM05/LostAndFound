export type ReportType = "lost" | "found";
export type ItemStatus =
  | "Saved"
  | "Matching"
  | "Potential Match"
  | "Awaiting Verification"
  | "Ready for Pickup"
  | "Returned"
  | "Secured"
  | "Archived";
export interface Item {
  deletionBlocked?: boolean;
  id: string;
  reporterId: string;
  type: ReportType;
  name: string;
  category: string;
  brand: string;
  model: string;
  color: string;
  secondaryColor?: string;
  size?: string;
  description: string;
  location: string;
  locationKnown?: boolean;
  buildingId?: string | null;
  lat: number | null;
  lng: number | null;
  dropoffZoneId?: string | null;
  foundAt?: string;
  receivedAt?: string;
  custodyStatus?: CustodyStatus;
  staffNotes?: string;
  reportedByRole?: Profile["role"];
  date: string;
  status: ItemStatus;
  image: string;
  imagePath?: string;
  imagePaths?: string[];
  features: string;
}
export type CustodyStatus =
  | "Received"
  | "Stored"
  | "Potential Match"
  | "Claim Pending"
  | "Ready for Pickup"
  | "Returned";
export interface DropoffZone {
  id: string;
  campusId: string;
  name: string;
  buildingId: string | null;
  building: string;
  description: string;
  lat: number | null;
  lng: number | null;
  active: boolean;
}
export interface PublicReport {
  id: string;
  type: ReportType;
  category: string;
  location: string;
  date: string;
  status: string;
}
export interface Match {
  id: string;
  lostId: string;
  foundId: string;
  score: number;
  factors: Record<string, number>;
  distance: number | null;
  minutes: number;
  dismissed?: boolean;
}
export interface Claim {
  id: string;
  matchId: string;
  claimantId: string;
  answers: string;
  score: number;
  status: "Pending" | "More information" | "Approved" | "Rejected" | "Returned";
  code?: string;
  token?: string;
  pickupLocation?: string;
}
export interface Profile {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin";
  verified: boolean;
}
export interface Notice {
  id: string;
  title: string;
  message: string;
  read: boolean;
  reportId?: string;
  matchId?: string;
  createdAt?: string;
}
export interface AppState {
  items: Item[];
  matches: Match[];
  claims: Claim[];
  notices: Notice[];
  privateDetails: Record<string, string>;
}
export const emptyState = (): AppState => ({
  items: [],
  matches: [],
  claims: [],
  notices: [],
  privateDetails: {},
});
