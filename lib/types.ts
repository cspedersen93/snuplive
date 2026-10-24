export type ShowStatus = "planned" | "live" | "ended";
export type ItemStatus = "queued" | "live" | "sold" | "unsold";

export interface Profile {
  id: string;
  handle: string;
  display_name: string | null;
  area: string | null;
  is_seller: boolean;
  avatar_path?: string | null;
  /** Privat eller erhverv (forbrugeraftaleloven § 8 a). Sættes, når man bliver sælger. */
  seller_type?: SellerType | null;
  business_name?: string | null;
  business_cvr?: string | null;
  seller_terms_at?: string | null;
  rating_avg?: number | string | null;
  rating_count?: number | null;
  /** Hvornår sælgeren bekræftede sig med MitID (kun tidspunktet er offentligt). */
  mitid_verified_at?: string | null;
}

export type SellerType = "private" | "business";

/** Det, køberen skal kunne se om sælgeren: privat eller erhverv, firma og bedømmelser. */
export const SELLER_FACT_COLS = "seller_type,business_name,business_cvr,rating_avg,rating_count,mitid_verified_at";
export type SellerFactsData = Pick<Profile, "seller_type" | "business_name" | "business_cvr" | "rating_avg" | "rating_count" | "mitid_verified_at">;

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
  category: string | null;
  description: string | null;
  images: string[];
  for_sale: boolean;
  listed_at: string | null;
  sale_type: "fixed" | "auction";
  /** Budsalg: hvornår uret står på 0, det højeste bud, og hvem der har det. */
  auction_ends_at: string | null;
  high_bid: number | null;
  high_bidder: string | null;
  high_handle: string | null;
  bid_count: number;
}

/** En ting fra items_feed (med show og sælger). */
export interface FeedItem {
  id: string;
  name: string;
  size: string | null;
  condition: string | null;
  price: number;
  images: string[];
  category: string;
  status: ItemStatus;
  for_sale: boolean;
  sale_type: "fixed" | "auction";
  description: string | null;
  show_id: string;
  show_title: string;
  show_status: "planned" | "live" | "ended";
  starts_at: string | null;
  listed_at: string | null;
  seller_id: string;
  handle: string;
  avatar_path: string | null;
  area: string | null;
  high_bid: number | null;
  bid_count: number;
  /** Klip fra live-showet (findes først, når 0015_klip.sql er kørt). */
  clip_path?: string | null;
  total: number;
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
  "id,show_id,seller_id,name,size,condition,price,position,status,rush_ends_at,sold_at,created_at,category,description,images,for_sale,listed_at,sale_type,auction_ends_at,high_bid,high_bidder,high_handle,bid_count";
export const SALE_COLS = "id,item_id,show_id,seller_id,buyer_id,price,status,created_at";
export const MESSAGE_COLS = "id,show_id,user_id,handle,body,kind,from_seller,created_at";
