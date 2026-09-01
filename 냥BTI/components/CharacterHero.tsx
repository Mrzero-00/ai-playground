import Image from "next/image";
import { CHARACTER_ASSETS } from "@/data/character-assets";
import type { TypeContent } from "@/types/nyangbti";

interface CharacterHeroProps {
  type: TypeContent;
  catName: string;
  resultName?: string;
}

export function CharacterHero({ type, catName, resultName }: CharacterHeroProps) {
  return (
    <div
      className="character-stage"
      role="img"
      aria-label={`${catName}의 ${resultName ?? type.name} 고양이 캐릭터`}
    >
      <Image
        className="character-stage__image"
        src={CHARACTER_ASSETS[type.code]}
        alt=""
        width={768}
        height={768}
        priority
        aria-hidden="true"
      />
    </div>
  );
}
