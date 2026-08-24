import type { TypeContent } from "@/types/nyangbti";

interface CharacterHeroProps {
  type: TypeContent;
  catName: string;
}

export function CharacterHero({ type, catName }: CharacterHeroProps) {
  return (
    <div
      className="character-stage"
      style={
        {
          "--character-primary": type.palette.primary,
          "--character-secondary": type.palette.secondary,
          "--character-accent": type.palette.accent,
        } as React.CSSProperties
      }
      role="img"
      aria-label={`${catName}의 ${type.name} 고양이 캐릭터`}
    >
      <span className="character-spark character-spark--one" aria-hidden="true">✦</span>
      <span className="character-spark character-spark--two" aria-hidden="true">●</span>
      <div className="cat-character" aria-hidden="true">
        <span className="cat-character__ear cat-character__ear--left" />
        <span className="cat-character__ear cat-character__ear--right" />
        <span className="cat-character__face">
          <span className="cat-character__eye cat-character__eye--left" />
          <span className="cat-character__eye cat-character__eye--right" />
          <span className="cat-character__nose" />
          <span className="cat-character__cheek cat-character__cheek--left" />
          <span className="cat-character__cheek cat-character__cheek--right" />
        </span>
        <span className="cat-character__body" />
        <span className="cat-character__tail" />
      </div>
    </div>
  );
}
