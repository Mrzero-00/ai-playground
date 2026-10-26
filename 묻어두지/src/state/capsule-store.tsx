import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

import {
  addDays,
  canAddItem,
  canSeal,
  isValidOpenAt,
  type Capsule,
  type CapsuleItem,
  type ItemKind,
  type PlantedLocation,
} from '@/domain/capsule';

type Action =
  | { type: 'create'; capsule: Capsule }
  | { type: 'addItem'; capsuleId: string; item: CapsuleItem }
  | { type: 'updateItem'; capsuleId: string; item: CapsuleItem }
  | { type: 'removeItem'; capsuleId: string; itemId: string }
  | { type: 'seal'; capsuleId: string; openAt: string; sealedAt: string }
  | { type: 'open'; capsuleId: string; openedAt: string }
  | { type: 'plant'; capsuleId: string; location: PlantedLocation };

type CapsuleStoreValue = {
  capsules: Capsule[];
  getCapsule: (id: string) => Capsule | null;
  createCapsule: (input: { title: string; deadlineDays: number }) => Capsule;
  addItem: (capsuleId: string, input: { kind: ItemKind; text?: string; uri?: string; durationMs?: number }) => CapsuleItem | null;
  updateItem: (capsuleId: string, item: CapsuleItem) => void;
  removeItem: (capsuleId: string, itemId: string) => void;
  sealCapsule: (capsuleId: string, openAt: string) => boolean;
  openCapsule: (capsuleId: string) => void;
  plantCapsule: (capsuleId: string, location: PlantedLocation) => void;
};

const CapsuleStoreContext = createContext<CapsuleStoreValue | null>(null);

function reducer(state: Capsule[], action: Action): Capsule[] {
  switch (action.type) {
    case 'create':
      return [action.capsule, ...state];
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
  const [capsules, dispatch] = useReducer(reducer, initialCapsules);

  const value = useMemo<CapsuleStoreValue>(() => {
    const getCapsule = (id: string) => capsules.find((capsule) => capsule.id === id) ?? null;
    return {
      capsules,
      getCapsule,
      createCapsule: ({ title, deadlineDays }) => {
        const createdAt = new Date().toISOString();
        const capsule: Capsule = {
          id: newId('cap'),
          title: title.trim(),
          createdAt,
          deadlineAt: addDays(createdAt, deadlineDays),
          status: 'collecting',
          sealedAt: null,
          openAt: null,
          openedAt: null,
          members: [{ id: 'me', name: '상길', isMe: true, isHost: true, items: [] }],
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
        if (!capsule || !canSeal(capsule) || !isValidOpenAt(sealedAt, openAt)) return false;
        dispatch({ type: 'seal', capsuleId, openAt, sealedAt });
        return true;
      },
      openCapsule: (capsuleId) => dispatch({ type: 'open', capsuleId, openedAt: new Date().toISOString() }),
      plantCapsule: (capsuleId, location) => dispatch({ type: 'plant', capsuleId, location }),
    };
  }, [capsules]);

  return <CapsuleStoreContext.Provider value={value}>{children}</CapsuleStoreContext.Provider>;
}

export function useCapsuleStore() {
  const value = useContext(CapsuleStoreContext);
  if (!value) throw new Error('useCapsuleStore must be used inside CapsuleStoreProvider');
  return value;
}
