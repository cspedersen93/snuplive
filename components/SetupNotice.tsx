export default function SetupNotice() {
  return (
    <div className="wrap" style={{ paddingBlock: "64px 96px" }}>
      <div className="notice" role="alert">
        <span>
          <b>SnupLive er ikke koblet til databasen endnu.</b> Tjek i Vercel, at{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> er din Project URL (fx https://abcd.supabase.co), og at{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> er din Publishable key. Tryk derefter Redeploy.
        </span>
      </div>
    </div>
  );
}
