import { supabaseSetupProblems } from "@/lib/env";

export default function SetupNotice() {
  const problems = supabaseSetupProblems();
  return (
    <div className="wrap" style={{ paddingBlock: "64px 96px" }}>
      <div className="notice" role="alert" style={{ flexDirection: "column", gap: 8 }}>
        <b>Relived er ikke koblet til databasen endnu.</b>
        {problems.length ? (
          <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
        <span>Ret det i Vercel under Settings → Environment Variables, og start en ny deployment af main.</span>
      </div>
    </div>
  );
}
