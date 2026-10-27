import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

import {
  MAX_MEMBERS,
  addDays,
  canAddItem,
  canSeal,
  findByInviteCode,
  generateInviteCode,
  isValidOpenAtForCreate,
  me,
  type Capsule,
  type CapsuleItem,
  type CapsuleMode,
  type ItemKind,
  type PlantedLocation,
} from '@/domain/capsule';

type Action =
  | { type: 'create'; capsule: Capsule }
  | { type: 'join'; capsuleId: string }
  | { type: 'addItem'; capsuleId: string; item: CapsuleItem }
  | { type: 'updateItem'; capsuleId: string; item: CapsuleItem }
  | { type: 'removeItem'; capsuleId: string; itemId: string }
  | { type: 'seal'; capsuleId: string; openAt: string; sealedAt: string }
  | { type: 'open'; capsuleId: string; openedAt: string }
  | { type: 'plant'; capsuleId: string; location: PlantedLocation };

export type JoinResult = { ok: true; capsule: Capsule; already: boolean } | { ok: false; reason: 'not-found' | 'closed' | 'full' };

type CapsuleStoreValue = {
  /** 내가 들어 있는 캡슐만. 초대 코드로 들어가기 전의 캡슐은 보이지 않는다. */
  capsules: Capsule[];
  getCapsule: (id: string) => Capsule | null;
  createCapsule: (input: { title: string; deadlineDays: number; openAt: string; mode: CapsuleMode; location?: PlantedLocation | null }) => Capsule | null;
  /** 초대 코드로 친구 캡슐에 들어간다. 이미 들어 있으면 그 캡슐을 그대로 돌려준다. */
  joinCapsule: (code: string) => JoinResult;
  addItem: (capsuleId: string, input: { kind: ItemKind; text?: string; uri?: string; durationMs?: number }) => CapsuleItem | null;
  updateItem: (capsuleId: string, item: CapsuleItem) => void;
  removeItem: (capsuleId: string, itemId: string) => void;
  /** 방장이 직접 닫거나(자동 닫힘 조건 충족 시 화면이 호출) 닫는다. 여는 시각은 만들 때 정한 값을 쓴다. */
  sealCapsule: (capsuleId: string, openAt?: string) => boolean;
  openCapsule: (capsuleId: string) => void;
  plantCapsule: (capsuleId: string, location: PlantedLocation) => void;
};

const CapsuleStoreContext = createContext<CapsuleStoreValue | null>(null);

function reducer(state: Capsule[], action: Action): Capsule[] {
  switch (action.type) {
    case 'create':
      return [action.capsule, ...state];
    case 'join':
      return state.map((capsule) =>
        capsule.id !== action.capsuleId || me(capsule) ? capsule : { ...capsule, members: [...capsule.members, { id: 'me', name: '상길', isMe: true, isHost: false, items: [] }] },
      );
    case 'addItem':
      return state.map((capsule) =>
        capsule.id !== action.capsuleId
          ? capsule
          : { ...capsule, members: capsule.members.map((member) => (member.isMe ? { ...member, items: [...member.items, action.item] } : member)) },
      );
    case 'updateItem':
      return state.map((capsule) =>
        capsule.id !== action.capsuleId
          ? capsule
          : {
              ...capsule,
              members: capsule.members.map((member) =>
                member.isMe ? { ...member, items: member.items.map((item) => (item.id === action.item.id ? action.item : item)) } : member,
              ),
            },
      );
    case 'removeItem':
      return state.map((capsule) =>
        capsule.id !== action.capsuleId
          ? capsule
          : { ...capsule, members: capsule.members.map((member) => (member.isMe ? { ...member, items: member.items.filter((item) => item.id !== action.itemId) } : member)) },
      );
    case 'seal':
      return state.map((capsule) =>
        capsule.id !== action.capsuleId ? capsule : { ...capsule, status: 'sealed', sealedAt: action.sealedAt, openAt: action.openAt },
      );
    case 'open':
      return state.map((capsule) => (capsule.id !== action.capsuleId ? capsule : { ...capsule, status: 'opened', openedAt: action.openedAt }));
    case 'plant':
      return state.map((capsule) => (capsule.id !== action.capsuleId ? capsule : { ...capsule, location: action.location }));
    default:
      return state;
  }
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function CapsuleStoreProvider({ children, initialCapsules }: { children: ReactNode; initialCapsules: Capsule[] }) {
  const [all, dispatch] = useReducer(reducer, initialCapsules);

  const value = useMemo<CapsuleStoreValue>(() => {
    const capsules = all.filter((capsule) => me(capsule) !== null);
    const getCapsule = (id: string) => capsules.find((capsule) => capsule.id === id) ?? null;
    return {
      capsules,
      getCapsule,
      joinCapsule: (code) => {
        const capsule = findByInviteCode(all, code);
        if (!capsule) return { ok: false, reason: 'not-found' };
        if (me(capsule)) return { ok: true, capsule, already: true };
        if (capsule.status !== 'collecting') return { ok: false, reason: 'closed' };
        if (capsule.members.length >= MAX_MEMBERS) return { ok: false, reason: 'full' };
        dispatch({ type: 'join', capsuleId: capsule.id });
        return { ok: true, capsule, already: false };
      },
      createCapsule: ({ title, deadlineDays, openAt, mode, location }) => {
        const createdAt = new Date().toISOString();
        const deadlineAt = addDays(createdAt, deadlineDays);
        if (!isValidOpenAtForCreate(createdAt, deadlineAt, openAt)) return null;
        const capsule: Capsule = {
          id: newId('cap'),
          title: title.trim(),
          createdAt,
          deadlineAt,
          status: 'collecting',
          sealedAt: null,
          openAt,
          openedAt: null,
          members: [{ id: 'me', name: '상길', isMe: true, isHost: true, items: [] }],
          mode,
          location: location ?? null,
          inviteCode: generateInviteCode(),
        };
        dispatch({ type: 'create', capsule });
        return capsule;
      },
      addItem: (capsuleId, input) => {
        const capsule = getCapsule(capsuleId);
        const mine = capsule?.members.find((member) => member.isMe);
        if (!capsule || !mine || capsule.status !== 'collecting' || !canAddItem(mine)) return null;
        const item: CapsuleItem = { id: newId('item'), createdAt: new Date().toISOString(), ...input };
        dispatch({ type: 'addItem', capsuleId, item });
        return item;
      },
      updateItem: (capsuleId, item) => dispatch({ type: 'updateItem', capsuleId, item }),
      removeItem: (capsuleId, itemId) => dispatch({ type: 'removeItem', capsuleId, itemId }),
      sealCapsule: (capsuleId, openAt) => {
        const capsule = getCapsule(capsuleId);
        const sealedAt = new Date().toISOString();
        const resolvedOpenAt = openAt ?? capsule?.openAt ?? null;
        if (!capsule || !canSeal(capsule) || !resolvedOpenAt) return false;
        dispatch({ type: 'seal', capsuleId, openAt: resolvedOpenAt, sealedAt });
        return true;
      },
      openCapsule: (capsuleId) => dispatch({ type: 'open', capsuleId, openedAt: new Date().toISOString() }),
      plantCapsule: (capsuleId, location) => dispatch({ type: 'plant', capsuleId, location }),
    };
  }, [all]);

  return <CapsuleStoreContext.Provider value={value}>{children}</CapsuleStoreContext.Provider>;
}

export function useCapsuleStore() {
  const value = useContext(CapsuleStoreContext);
  if (!value) throw new Error('useCapsuleStore must be used inside CapsuleStoreProvider');
  return value;
}
