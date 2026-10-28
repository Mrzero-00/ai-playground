import { THEME } from '@/constants/theme';

/**
 * 시안별 캡슐 이미지와, 그 1024² 이미지 안에서 계란이 차지하는 범위(비율).
 * 이음새(seam)에서 위·아래로 나눠 뚜껑만 들어 올린다. 값은 design/keyvisual 의 원본을 측정한 것.
 */
export const CapsuleArt =
  THEME === 'analog90'
    ? {
        // 은색 계란 + 황동 띠. 가로 200~823, 세로 76~955, 황동 띠 568~599.
        image: require('../../assets/capsule/egg-silver.png'),
        left: 200 / 1024,
        width: (823 - 200) / 1024,
        top: 76 / 1024,
        height: (955 - 76) / 1024,
        seam: 583 / 1024,
      }
    : {
        // 하늘색 스티커 계란 + 노란 띠. 가로 209~812, 세로 74~949, 이음새 561~592.
        image: require('../../assets/capsule/egg-closed.png'),
        left: 209 / 1024,
        width: (812 - 209) / 1024,
        top: 74 / 1024,
        height: (949 - 74) / 1024,
        seam: 576 / 1024,
      };
