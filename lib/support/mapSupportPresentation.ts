// lib/support/mapSupportPresentation.ts

export type SupportState = 'none' | 'pending' | 'active' | 'resolved' | 'archived';

export function mapSupportPresentation(state: SupportState) {
  switch (state) {
    case "pending":
      return {
        label: "Pending",
        tone: "yellow",
      };
    case "active":
      return {
        label: "Active",
        tone: "blue",
      };
    case "resolved":
      return {
        label: "Resolved",
        tone: "green",
      };
    case "none":
      return {
        label: "Never requested support",
        tone: "gray",
      };
    case "archived":
      return {
        label: "Archived",
        tone: "darkGray",
      };
  }
}
