interface Props {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageHeading({ eyebrow, title, description }: Props) {
  return (
    <header className="mb-6 border-b border-slate-6 pb-5 sm:mb-7">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-1.5 font-serif text-[30px] font-medium leading-tight tracking-tight text-slate-12 sm:text-[34px]">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-11">{description}</p>
    </header>
  );
}
