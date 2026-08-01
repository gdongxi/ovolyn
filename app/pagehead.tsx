import { ReededRule } from "./engraving";

/** Every functional page opens the same way: a rule, a name, a sentence. */
export function PageHead({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="pagehead">
      <ReededRule className="pagehead-reed" width={200} />
      <h1 className="display">{title}</h1>
      <p>{lede}</p>
    </div>
  );
}
