import Link from "next/link";
import Avatar from "@/components/Avatar";
import RemindButton from "@/components/RemindButton";
import ReportButton from "@/components/ReportButton";
import { clock, dayLabel } from "@/lib/format";
import { storageUrl } from "@/lib/images";
import { postAge, type Post } from "@/lib/posts";
import PostDelete from "./PostDelete";

/** Et opslag fra en sælger: tekst, billeder og eventuelt det show, opslaget handler om. */
export default function PostCard({ post, own = false, next }: { post: Post; own?: boolean; next: string }) {
  const handle = post.seller?.handle ?? "";
  const show = post.show;
  const imgs = post.images.slice(0, 4);
  return (
    <article className="post" id={`opslag-${post.id}`}>
      <header className="post-head">
        <Link className="post-who" href={`/profil/${handle}`}>
          <Avatar handle={handle} path={post.seller?.avatar_path} size={40} />
          <span>
            <b>{handle}</b>
            <time dateTime={post.created_at}>{postAge(post.created_at)}</time>
          </span>
        </Link>
        {own ? <PostDelete id={post.id} images={post.images} /> : <ReportButton type="post" id={post.id} className="post-report" />}
      </header>
      <p className="post-body">{post.body}</p>
      {imgs.length ? (
        <div className={`post-imgs n${imgs.length}`}>
          {imgs.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p} src={storageUrl("covers", p)} alt="" loading="lazy" />
          ))}
        </div>
      ) : null}
      {show ? (
        <div className="post-show">
          <span>
            <span className="label brass">
              {show.status === "live" ? "Live nu" : show.status === "ended" ? "Showet er slut" : show.starts_at ? `${dayLabel(show.starts_at)} kl. ${clock(show.starts_at)}` : "Kommende show"}
            </span>
            <Link href={`/live/${handle}`}>{show.title}</Link>
          </span>
          {show.status === "live" ? (
            <Link className="btn btn-red btn-sm" href={`/live/${handle}`}>Se med</Link>
          ) : show.status === "planned" ? (
            <RemindButton showId={show.id} next={next} className="btn btn-line btn-sm" />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
