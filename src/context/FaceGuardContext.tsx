/**
 * FaceGuardContext.tsx
 * Global state for enrolled users, sync status, and app settings.
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { DatabaseService, User } from '../services/DatabaseService';
import { SyncService, SyncStatus } from '../services/SyncService';
import NetInfo from '@react-native-community/netinfo';

interface FaceGuardState {
  users: User[];
  syncStatus: SyncStatus;
  isLoading: boolean;
  networkOnline: boolean;
  pendingCount: number;
}

type Action =
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_NETWORK'; payload: boolean }
  | { type: 'SET_PENDING_COUNT'; payload: number }
  | { type: 'ADD_USER'; payload: User }
  | { type: 'REMOVE_USER'; payload: string };

const initialState: FaceGuardState = {
  users: [],
  syncStatus: { isOnline: false, lastSyncAt: null, pendingCount: 0, syncInProgress: false, lastError: null },
  isLoading: true,
  networkOnline: false,
  pendingCount: 0,
};

function reducer(state: FaceGuardState, action: Action): FaceGuardState {
  switch (action.type) {
    case 'SET_USERS': return { ...state, users: action.payload };
    case 'SET_SYNC_STATUS': return { ...state, syncStatus: action.payload };
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    case 'SET_NETWORK': return { ...state, networkOnline: action.payload };
    case 'SET_PENDING_COUNT': return { ...state, pendingCount: action.payload };
    case 'ADD_USER': return { ...state, users: [...state.users, action.payload] };
    case 'REMOVE_USER': return { ...state, users: state.users.filter(u => u.id !== action.payload) };
    default: return state;
  }
}

interface ContextValue {
  state: FaceGuardState;
  dispatch: React.Dispatch<Action>;
  refreshUsers: () => Promise<void>;
  refreshSyncStatus: () => Promise<void>;
}

const FaceGuardContext = createContext<ContextValue | null>(null);

export const FaceGuardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    refreshUsers();
    refreshSyncStatus();

    const unsubscribe = NetInfo.addEventListener(netState => {
      dispatch({ type: 'SET_NETWORK', payload: netState.isConnected === true });
    });
    return () => unsubscribe();
  }, []);

  const refreshUsers = async () => {
    try {
      const users = await DatabaseService.getAllUsers();
      dispatch({ type: 'SET_USERS', payload: users });
    } catch (e) {
      console.error('refreshUsers error:', e);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const refreshSyncStatus = async () => {
    const status = await SyncService.getStatus();
    dispatch({ type: 'SET_SYNC_STATUS', payload: status });
    dispatch({ type: 'SET_PENDING_COUNT', payload: status.pendingCount });
  };

  return (
    <FaceGuardContext.Provider value={{ state, dispatch, refreshUsers, refreshSyncStatus }}>
      {children}
    </FaceGuardContext.Provider>
  );
};

export const useFaceGuard = (): ContextValue => {
  const ctx = useContext(FaceGuardContext);
  if (!ctx) throw new Error('useFaceGuard must be used within FaceGuardProvider');
  return ctx;
};
