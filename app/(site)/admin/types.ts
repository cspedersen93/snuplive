export interface MemberRow {
  id: string;
  handle: string;
  display_name: string | null;
  area: string | null;
  avatar_path: string | null;
  is_seller: boolean;
  created_at: string;
  email: string;
  purchases: number;
  spent: number;
  items_sold: number;
  earned: number;
  payout_ready: boolean;
  shows: number;
  open_issues: number;
  blocked_by: number;
  total: number;
}
