export default function SetupNotice() {
  return (
    <div className="wrap" style={{ paddingBlock: "64px 96px" }}>
      <div className="notice" role="alert">
        <span>
          <b>SnupLive er ikke koblet til databasen endnu.</b> Læg Supabase-nøglerne ind i Vercel som beskrevet i
          README-filen, og deploy igen.
        </span>
      </div>
    </div>
  );
}
