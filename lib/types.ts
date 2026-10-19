export type ShowStatus = "planned" | "live" | "ended";
export type ItemStatus = "queued" | "live" | "sold" | "unsold";

export interface Profile {
  id: string;
  handle: string;
  display_name: string | null;
  area: string | null;
  is_seller: boolean;
  avatar_path?: string | null;
}

export interface Show {
  id: string;
  seller_id: string;
  title: string;
  category: string;
  status: ShowStatus;
  starts_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  current_item_id: string | null;
  cover_path?: string | null;
  cover_at?: string | null;
  created_at: string;
}

export interface ShowWithSeller extends Show {
  seller: Pick<Profile, "handle" | "display_name" | "area" | "avatar_path"> | null;
  items?: { count: number }[];
}

export interface Item {
  id: string;
  show_id: string;
  seller_id: string;
  name: string;
  size: string | null;
  condition: string | null;
  price: number;
  position: number;
  status: ItemStatus;
  rush_ends_at: string | null;
  sold_at: string | null;
  created_at: string;
}

export type SaleStatus = "reserved" | "paid" | "shipped" | "done" | "cancelled";

export interface Sale {
  id: string;
  item_id: string;
  show_id: string;
  seller_id: string;
  buyer_id: string;
  price: number;
  status: SaleStatus;
  created_at: string;
}

export interface Message {
  id: number;
  show_id: string;
  user_id: string | null;
  handle: string;
  body: string;
  kind: "chat" | "event";
  from_seller: boolean;
  created_at: string;
}

export const SHOW_COLS =
  "id,seller_id,title,category,status,starts_at,started_at,ended_at,current_item_id,cover_path,cover_at,created_at";
export const ITEM_COLS =
  "id,show_id,seller_id,name,size,condition,price,position,status,rush_ends_at,sold_at,created_at";
export const SALE_COLS = "id,item_id,show_id,seller_id,buyer_id,price,status,created_at";
export const MESSAGE_COLS = "id,show_id,user_id,handle,body,kind,from_seller,created_at";
